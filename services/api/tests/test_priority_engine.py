"""Test suite for Deterministic Maintenance Priority Engine (Batch 5A & 5A.1).

Tests:
1. Normal task scoring (computed_priority_score & baseline_priority_score)
2. High & Critical severity task scoring
3. Critical asset scoring using verified 1.0-5.0 scale
4. Large overdue value capping (boundary test at 30 days)
5. Missing optional fields (conservative below-midpoint fallbacks: crit=40.0, risk=20.0)
6. Invalid / unrecognized severity handling
7. Score bounded strictly to [0.0, 100.0]
8. Determinism / idempotency (same input -> identical score)
9. Priority band thresholds (CRITICAL, HIGH, MEDIUM, LOW)
10. Explainability reasons correspond to input facts
11. GET /api/v1/maintenance-tasks/{task_id}/priority endpoint with computed_priority_score & baseline_priority_score
12. Unknown task returns 404 Not Found
13. Unauthenticated request to /priority returns 401 Unauthorized
14. Existing maintenance list API continues to work without regression
"""

import asyncio
import json
import os
from pathlib import Path
import sys
import unittest
import urllib.parse
import urllib.request

API_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = API_DIR.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))
sys.path.insert(0, str(API_DIR))

if sys.platform == "win32":
    try:
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    except Exception:
        pass

from app.main import app
from app.services.priority_engine import (
    calculate_criticality_component,
    calculate_failure_risk_component,
    calculate_overdue_component,
    calculate_severity_component,
    compute_priority,
    determine_priority_band,
)

KEYCLOAK_URL = os.getenv("KEYCLOAK_URL", "http://127.0.0.1:8080").replace("localhost", "127.0.0.1").rstrip("/")
REALM = "railopt"
CLIENT_ID = "railopt-web"
DEMO_PASSWORD = os.getenv("DEMO_USER_PASSWORD", "railopt_demo_2026")


def obtain_demo_token(username: str = "engineering.demo") -> str:
    """Acquire real JWT access token from Keycloak for testing."""
    url = f"{KEYCLOAK_URL}/realms/{REALM}/protocol/openid-connect/token"
    data = urllib.parse.urlencode({
        "client_id": CLIENT_ID,
        "username": username,
        "password": DEMO_PASSWORD,
        "grant_type": "password",
        "scope": "openid profile email",
    }).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        res = json.loads(resp.read().decode("utf-8"))
        return res["access_token"]


async def asgi_request(
    app,
    method: str,
    path: str,
    token: str | None = None,
    query_string: str = "",
) -> tuple[int, dict]:
    """Execute an ASGI request directly through FastAPI."""
    headers = [
        (b"host", b"testserver"),
        (b"accept", b"application/json"),
    ]
    if token:
        headers.append((b"authorization", f"Bearer {token}".encode("utf-8")))

    scope = {
        "type": "http",
        "asgi": {"version": "3.0", "spec_version": "2.0"},
        "http_version": "1.1",
        "method": method.upper(),
        "scheme": "http",
        "path": path,
        "raw_path": path.encode("utf-8"),
        "query_string": query_string.encode("utf-8"),
        "headers": headers,
        "state": {},
    }

    response_status = 500
    response_body = bytearray()

    async def receive():
        return {"type": "http.request", "body": b"", "more_body": False}

    async def send(message):
        nonlocal response_status, response_body
        if message["type"] == "http.response.start":
            response_status = message["status"]
        elif message["type"] == "http.response.body":
            response_body.extend(message.get("body", b""))

    await app(scope, receive, send)
    parsed_json = json.loads(response_body.decode("utf-8")) if response_body else {}
    return response_status, parsed_json


class TestPriorityEngineUnit(unittest.TestCase):
    """Unit tests for the pure scoring logic and mathematical invariants."""

    def test_01_normal_task(self):
        """1. Normal baseline task produces expected components and computed_priority_score."""
        res = compute_priority(
            task_id="TASK-TEST-01",
            department="Engineering",
            severity="Medium",
            days_overdue=10,
            asset_id="TRK-01",
            criticality_index=3.0,
            failure_risk_score=0.25,
            baseline_priority_score=40.0,
        )
        self.assertEqual(res.task_id, "TASK-TEST-01")
        self.assertEqual(res.baseline_priority_score, 40.0)
        self.assertEqual(res.components.severity_component, 50.0)
        self.assertAlmostEqual(res.components.overdue_component, 33.33, places=1)
        self.assertEqual(res.components.criticality_component, 60.0)
        self.assertEqual(res.components.failure_risk_component, 25.0)
        # Expected: 0.35*50 + 0.25*33.33 + 0.25*60 + 0.15*25 = 17.5 + 8.33 + 15 + 3.75 = 44.58
        self.assertAlmostEqual(res.computed_priority_score, 44.58, places=1)
        self.assertEqual(res.priority_band, "MEDIUM")

    def test_02_high_and_critical_severity(self):
        """2. High & Critical severity elevate priority significantly."""
        res_high = compute_priority(
            task_id="TASK-TEST-HIGH",
            department="S&T",
            severity="High",
            days_overdue=5,
            criticality_index=2.0,
            failure_risk_score=0.1,
        )
        self.assertEqual(res_high.components.severity_component, 75.0)
        self.assertTrue(any("severity is rated as 'High'" in r for r in res_high.reasons))

        res_crit = compute_priority(
            task_id="TASK-TEST-CRIT",
            department="TRD",
            severity="Critical",
            days_overdue=30,
            criticality_index=5.0,
            failure_risk_score=0.9,
        )
        self.assertEqual(res_crit.components.severity_component, 100.0)
        self.assertEqual(res_crit.components.overdue_component, 100.0)
        self.assertEqual(res_crit.components.criticality_component, 100.0)
        self.assertEqual(res_crit.components.failure_risk_component, 90.0)
        # 0.35*100 + 0.25*100 + 0.25*100 + 0.15*90 = 35 + 25 + 25 + 13.5 = 98.5
        self.assertEqual(res_crit.computed_priority_score, 98.5)
        self.assertEqual(res_crit.priority_band, "CRITICAL")

    def test_03_critical_asset_impact(self):
        """3. Asset with maximum criticality index raises criticality component."""
        res = compute_priority(
            task_id="TASK-CRIT-ASSET",
            department="Engineering",
            severity="Low",
            days_overdue=0,
            asset_id="TRK-HWH-01",
            criticality_index=5.0,
            failure_risk_score=0.05,
        )
        self.assertEqual(res.components.criticality_component, 100.0)
        self.assertTrue(any("high operational criticality" in r for r in res.reasons))

    def test_04_large_overdue_capping(self):
        """4. Large overdue values (e.g. 100 days) cap smoothly at 100.0."""
        res_30 = compute_priority(task_id="T30", department="Engineering", days_overdue=30)
        res_90 = compute_priority(task_id="T90", department="Engineering", days_overdue=90)
        self.assertEqual(res_30.components.overdue_component, 100.0)
        self.assertEqual(res_90.components.overdue_component, 100.0)

    def test_05_missing_optional_fields(self):
        """5. Missing optional fields receive conservative below-midpoint fallbacks."""
        res_sparse = compute_priority(
            task_id="TASK-SPARSE",
            department="Engineering",
            severity=None,
            days_overdue=None,
            criticality_index=None,
            failure_risk_score=None,
        )
        self.assertEqual(res_sparse.components.severity_component, 25.0)
        self.assertEqual(res_sparse.components.overdue_component, 0.0)
        self.assertEqual(res_sparse.components.criticality_component, 40.0)
        self.assertEqual(res_sparse.components.failure_risk_component, 20.0)
        # 0.35*25 + 0.25*0 + 0.25*40 + 0.15*20 = 8.75 + 0 + 10 + 3 = 21.75
        self.assertEqual(res_sparse.computed_priority_score, 21.75)
        self.assertEqual(res_sparse.priority_band, "LOW")

    def test_06_unrecognized_input_handling(self):
        """6. Unrecognized severity strings default safely without crashing."""
        res_unknown = compute_priority(
            task_id="TASK-UNK",
            department="S&T",
            severity="UNKNOWN_SEVERITY_XYZ",
        )
        self.assertEqual(res_unknown.components.severity_component, 25.0)

    def test_07_score_bounds(self):
        """7. Score remains strictly bounded within [0.0, 100.0]."""
        # Minimum possible
        res_min = compute_priority(
            task_id="MIN", department="Engineering", severity="Low", days_overdue=0, criticality_index=0.0, failure_risk_score=0.0
        )
        self.assertGreaterEqual(res_min.computed_priority_score, 0.0)

        # Maximum possible
        res_max = compute_priority(
            task_id="MAX", department="Engineering", severity="Critical", days_overdue=100, criticality_index=5.0, failure_risk_score=1.0
        )
        self.assertLessEqual(res_max.computed_priority_score, 100.0)
        self.assertEqual(res_max.computed_priority_score, 100.0)

    def test_08_determinism_and_idempotency(self):
        """8. Same input produces exactly the identical output across multiple runs."""
        args = {
            "task_id": "DETERMINISTIC-1",
            "department": "TRD",
            "severity": "High",
            "days_overdue": 14,
            "asset_id": "OHE-HWH-01",
            "criticality_index": 4.0,
            "failure_risk_score": 0.45,
            "baseline_priority_score": 85.0,
        }
        res1 = compute_priority(**args)
        res2 = compute_priority(**args)
        self.assertEqual(res1.computed_priority_score, res2.computed_priority_score)
        self.assertEqual(res1.baseline_priority_score, res2.baseline_priority_score)
        self.assertEqual(res1.priority_band, res2.priority_band)
        self.assertEqual(res1.components, res2.components)
        self.assertEqual(res1.reasons, res2.reasons)

    def test_09_priority_bands_thresholds(self):
        """9. Priority band thresholds match specification."""
        self.assertEqual(determine_priority_band(85.0), "CRITICAL")
        self.assertEqual(determine_priority_band(80.0), "CRITICAL")
        self.assertEqual(determine_priority_band(79.99), "HIGH")
        self.assertEqual(determine_priority_band(60.0), "HIGH")
        self.assertEqual(determine_priority_band(59.99), "MEDIUM")
        self.assertEqual(determine_priority_band(40.0), "MEDIUM")
        self.assertEqual(determine_priority_band(39.99), "LOW")
        self.assertEqual(determine_priority_band(0.0), "LOW")


class TestPriorityEngineIntegration(unittest.IsolatedAsyncioTestCase):
    """Integration tests running against the live database and API endpoint."""

    async def asyncSetUp(self):
        try:
            self.token = obtain_demo_token("engineering.demo")
        except Exception:
            self.token = None

    async def test_10_priority_endpoint_authenticated(self):
        """10. GET /api/v1/maintenance-tasks/WO-0001/priority returns computed and baseline scores."""
        self.assertIsNotNone(self.token, "Keycloak demo token required")
        status, data = await asgi_request(app, "GET", "/api/v1/maintenance-tasks/WO-0001/priority", token=self.token)
        self.assertEqual(status, 200)
        self.assertEqual(data["task_id"], "WO-0001")
        self.assertIn("computed_priority_score", data)
        self.assertIn("baseline_priority_score", data)
        self.assertIn("priority_band", data)
        self.assertIn("components", data)
        self.assertIn("reasons", data)
        self.assertIsInstance(data["reasons"], list)
        self.assertGreater(len(data["reasons"]), 0)
        self.assertIn(data["priority_band"], ["CRITICAL", "HIGH", "MEDIUM", "LOW"])

    async def test_11_priority_endpoint_unauthenticated(self):
        """11. GET /api/v1/maintenance-tasks/WO-0001/priority without token returns 401."""
        status, data = await asgi_request(app, "GET", "/api/v1/maintenance-tasks/WO-0001/priority")
        self.assertEqual(status, 401)
        self.assertIn("detail", data)

    async def test_12_priority_endpoint_unknown_task_404(self):
        """12. GET /api/v1/maintenance-tasks/UNKNOWN-9999/priority returns 404."""
        self.assertIsNotNone(self.token)
        status, data = await asgi_request(app, "GET", "/api/v1/maintenance-tasks/UNKNOWN-9999/priority", token=self.token)
        self.assertEqual(status, 404)
        self.assertIn("detail", data)

    async def test_13_maintenance_list_regression(self):
        """13. Existing maintenance list endpoint continues to work without regression."""
        self.assertIsNotNone(self.token)
        status, data = await asgi_request(app, "GET", "/api/v1/maintenance-tasks", token=self.token)
        self.assertEqual(status, 200)
        self.assertEqual(data["total"], 53)


if __name__ == "__main__":
    unittest.main()
