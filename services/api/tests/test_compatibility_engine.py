"""Test suite for Deterministic Maintenance Task Compatibility and Integrated-Block Opportunity Engine (Batch 5B).

Tests:
1. Two compatible tasks in the same section.
2. Engineering + S&T compatible pair.
3. Engineering + TRD compatible pair.
4. Engineering + S&T + TRD compatible group.
5. Different-section tasks -> INCOMPATIBLE.
6. Overly long combined duration calculation and scoring.
7. Duplicate task validation in group evaluation.
8. Group size boundary validation (min 2, max 3).
9. Department list uniqueness and sorting.
10. Compatibility score bounded to [0.0, 100.0].
11. Deterministic repeatability / idempotency.
12. Explainability reasons correspond to input facts.
13. Static route `/maintenance-tasks/integration-opportunities` not shadowed by `/{task_id}`.
14. Unknown task returns 404 on task-specific opportunities endpoint.
15. Task-specific integration opportunities endpoint returns matches.
16. Existing priority endpoint still works.
17. Existing maintenance list and read APIs continue to work without regression.
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
from app.services.compatibility_engine import (
    calculate_combined_duration,
    evaluate_group_compatibility,
    TaskProfile,
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


class TestCompatibilityEngineUnit(unittest.TestCase):
    """Unit tests for pure task compatibility evaluation logic."""

    def setUp(self):
        self.task_eng = TaskProfile(
            task_id="WO-0001",
            section_id="HOW_SEC_001",
            department="Engineering",
            severity="Medium",
            days_overdue=10,
            required_duration_hrs=3.0,
            status="Open",
            computed_priority_score=60.0,
            asset_id="TRK-HWH-01",
        )
        self.task_snt = TaskProfile(
            task_id="WO-0002",
            section_id="HOW_SEC_001",
            department="S&T",
            severity="High",
            days_overdue=12,
            required_duration_hrs=2.0,
            status="Open",
            computed_priority_score=75.0,
            asset_id="SIG-HWH-01",
        )
        self.task_trd = TaskProfile(
            task_id="WO-0003",
            section_id="HOW_SEC_001",
            department="TRD",
            severity="Critical",
            days_overdue=15,
            required_duration_hrs=4.0,
            status="Open",
            computed_priority_score=85.0,
            asset_id="OHE-HWH-01",
        )
        self.task_other_sec = TaskProfile(
            task_id="WO-0099",
            section_id="HOW_SEC_002",
            department="Engineering",
            severity="Low",
            days_overdue=5,
            required_duration_hrs=2.0,
            status="Open",
            computed_priority_score=35.0,
            asset_id="TRK-DKAE-01",
        )

    def test_01_two_compatible_tasks_same_section(self):
        """1. Two tasks in same section produce a valid integration opportunity."""
        opp = evaluate_group_compatibility([self.task_eng, self.task_snt])
        self.assertEqual(opp.section_id, "HOW_SEC_001")
        self.assertEqual(opp.task_ids, ["WO-0001", "WO-0002"])
        self.assertEqual(opp.departments_involved, ["Engineering", "S&T"])
        self.assertTrue(opp.is_cross_department)
        self.assertEqual(opp.spatial_compatibility, "COMPATIBLE")
        self.assertGreaterEqual(opp.compatibility_score, 75.0)
        self.assertEqual(opp.compatibility_status, "COMPATIBLE")
        self.assertIn("candidate-screening signal", opp.advisory_note)
        self.assertIn("NOT a validated engineering or safety approval", opp.advisory_note)

    def test_02_engineering_snt_pair(self):
        """2. Engineering + S&T pair is flagged as cross-department."""
        opp = evaluate_group_compatibility([self.task_eng, self.task_snt])
        self.assertTrue(opp.is_cross_department)
        self.assertIn("Engineering", opp.departments_involved)
        self.assertIn("S&T", opp.departments_involved)

    def test_03_engineering_trd_pair(self):
        """3. Engineering + TRD pair is flagged as cross-department."""
        opp = evaluate_group_compatibility([self.task_eng, self.task_trd])
        self.assertTrue(opp.is_cross_department)
        self.assertEqual(opp.departments_involved, ["Engineering", "TRD"])

    def test_04_three_department_group(self):
        """4. Engineering + S&T + TRD 3-task group evaluated correctly."""
        opp = evaluate_group_compatibility([self.task_eng, self.task_snt, self.task_trd])
        self.assertEqual(len(opp.task_ids), 3)
        self.assertEqual(opp.departments_involved, ["Engineering", "S&T", "TRD"])
        self.assertTrue(opp.is_cross_department)
        # Combined duration: max(3.0, 2.0, 4.0) + 0.15*(3.0+2.0) = 4.0 + 0.75 = 4.75 hrs
        self.assertEqual(opp.combined_duration_hrs, 4.75)
        self.assertEqual(opp.priority_summary.highest_task_priority, 85.0)
        self.assertEqual(opp.priority_summary.total_priority_value, 220.0)

    def test_05_different_sections_incompatible(self):
        """5. Tasks on different sections produce INCOMPATIBLE spatial status and score 0.0."""
        opp = evaluate_group_compatibility([self.task_eng, self.task_other_sec])
        self.assertEqual(opp.spatial_compatibility, "INCOMPATIBLE")
        self.assertEqual(opp.compatibility_score, 0.0)
        self.assertEqual(opp.compatibility_status, "INCOMPATIBLE")

    def test_06_long_combined_duration(self):
        """6. Long combined duration reflects lower duration compatibility."""
        task_long_1 = TaskProfile(
            task_id="WO-LONG-1", section_id="SEC-1", department="Engineering",
            severity="Medium", days_overdue=5, required_duration_hrs=8.0,
            status="Open", computed_priority_score=50.0, asset_id="A1",
        )
        task_long_2 = TaskProfile(
            task_id="WO-LONG-2", section_id="SEC-1", department="TRD",
            severity="Medium", days_overdue=5, required_duration_hrs=8.0,
            status="Open", computed_priority_score=50.0, asset_id="A2",
        )
        opp = evaluate_group_compatibility([task_long_1, task_long_2])
        # Combined: 8.0 + 0.15*8.0 = 9.2 hrs (> 8 hrs)
        self.assertEqual(opp.combined_duration_hrs, 9.2)
        self.assertEqual(opp.duration_compatibility, "INCOMPATIBLE")

    def test_07_duplicate_task_rejected(self):
        """7. Duplicate task IDs in the same group raise ValueError."""
        with self.assertRaises(ValueError):
            evaluate_group_compatibility([self.task_eng, self.task_eng])

    def test_08_group_size_bounds(self):
        """8. Group size must be strictly 2 or 3."""
        with self.assertRaises(ValueError):
            evaluate_group_compatibility([self.task_eng])  # Size 1

        t4 = TaskProfile(
            task_id="WO-4", section_id="HOW_SEC_001", department="TRD",
            severity="Low", days_overdue=0, required_duration_hrs=1.0,
            status="Open", computed_priority_score=20.0, asset_id="A4",
        )
        with self.assertRaises(ValueError):
            evaluate_group_compatibility([self.task_eng, self.task_snt, self.task_trd, t4])  # Size 4

    def test_09_department_list_ordering(self):
        """9. Departments list is deduplicated and sorted."""
        task_eng_2 = TaskProfile(
            task_id="WO-ENG-2", section_id="HOW_SEC_001", department="Engineering",
            severity="Low", days_overdue=0, required_duration_hrs=1.0,
            status="Open", computed_priority_score=20.0, asset_id="A5",
        )
        opp = evaluate_group_compatibility([self.task_trd, self.task_eng, task_eng_2])
        self.assertEqual(opp.departments_involved, ["Engineering", "TRD"])

    def test_10_score_bounds_and_determinism(self):
        """10. Compatibility score is strictly bounded [0, 100] and identical across multiple runs."""
        opp1 = evaluate_group_compatibility([self.task_eng, self.task_snt])
        opp2 = evaluate_group_compatibility([self.task_eng, self.task_snt])
        self.assertGreaterEqual(opp1.compatibility_score, 0.0)
        self.assertLessEqual(opp1.compatibility_score, 100.0)
        self.assertEqual(opp1.compatibility_score, opp2.compatibility_score)
        self.assertEqual(opp1.opportunity_id, opp2.opportunity_id)
        self.assertEqual(opp1.compatibility_reasons, opp2.compatibility_reasons)


class TestCompatibilityEngineIntegration(unittest.IsolatedAsyncioTestCase):
    """Integration tests running against the live database and FastAPI ASGI stack."""

    async def asyncSetUp(self):
        try:
            self.token = obtain_demo_token("engineering.demo")
        except Exception:
            self.token = None

    async def test_11_list_integration_opportunities_authenticated(self):
        """11. GET /api/v1/maintenance-tasks/integration-opportunities returns opportunity list."""
        self.assertIsNotNone(self.token, "Keycloak demo token required")
        status, data = await asgi_request(
            app,
            "GET",
            "/api/v1/maintenance-tasks/integration-opportunities",
            token=self.token,
            query_string="page_size=10",
        )
        self.assertEqual(status, 200)
        self.assertIn("items", data)
        self.assertIn("total", data)
        self.assertGreater(data["total"], 0)
        self.assertLessEqual(len(data["items"]), 10)

        # Inspect first opportunity
        first = data["items"][0]
        self.assertIn("opportunity_id", first)
        self.assertIn("section_id", first)
        self.assertIn("task_ids", first)
        self.assertIn("departments_involved", first)
        self.assertIn("combined_duration_hrs", first)
        self.assertIn("priority_summary", first)
        self.assertIn("compatibility_reasons", first)
        self.assertIn("advisory_note", first)
        self.assertIn("NOT a validated engineering or safety approval", first["advisory_note"])

    async def test_12_filter_cross_department(self):
        """12. Filter cross_department=true returns only multi-department opportunities."""
        self.assertIsNotNone(self.token)
        status, data = await asgi_request(
            app,
            "GET",
            "/api/v1/maintenance-tasks/integration-opportunities",
            token=self.token,
            query_string="cross_department=true",
        )
        self.assertEqual(status, 200)
        for item in data["items"]:
            self.assertTrue(item["is_cross_department"])
            self.assertGreater(len(item["departments_involved"]), 1)

    async def test_13_filter_section_id(self):
        """13. Filter by section_id=HOW_SEC_001 isolates section opportunities."""
        self.assertIsNotNone(self.token)
        status, data = await asgi_request(
            app,
            "GET",
            "/api/v1/maintenance-tasks/integration-opportunities",
            token=self.token,
            query_string="section_id=HOW_SEC_001",
        )
        self.assertEqual(status, 200)
        for item in data["items"]:
            self.assertEqual(item["section_id"], "HOW_SEC_001")

    async def test_14_task_specific_opportunities(self):
        """14. GET /api/v1/maintenance-tasks/{task_id}/integration-opportunities returns task's opps."""
        self.assertIsNotNone(self.token)
        status, data = await asgi_request(
            app,
            "GET",
            "/api/v1/maintenance-tasks/WO-0001/integration-opportunities",
            token=self.token,
        )
        self.assertEqual(status, 200)
        self.assertIsInstance(data, list)
        for opp in data:
            self.assertIn("WO-0001", opp["task_ids"])
            self.assertIn("advisory_note", opp)
            self.assertIn("NOT a validated engineering or safety approval", opp["advisory_note"])

    async def test_15_task_specific_opportunities_unknown_404(self):
        """15. Unknown task ID returns 404 on task-specific opportunities endpoint."""
        self.assertIsNotNone(self.token)
        status, data = await asgi_request(
            app,
            "GET",
            "/api/v1/maintenance-tasks/UNKNOWN-9999/integration-opportunities",
            token=self.token,
        )
        self.assertEqual(status, 404)
        self.assertIn("detail", data)

    async def test_16_static_route_not_shadowed(self):
        """16. Verify static /integration-opportunities is not captured as a {task_id}."""
        self.assertIsNotNone(self.token)
        # Calling without trailing slash or params
        status, data = await asgi_request(
            app,
            "GET",
            "/api/v1/maintenance-tasks/integration-opportunities",
            token=self.token,
        )
        # If it were captured by /{task_id}, it would try to find task 'integration-opportunities' and return 404 or a single task detail
        self.assertEqual(status, 200)
        self.assertIn("items", data)
        self.assertIn("total", data)

    async def test_17_existing_endpoints_regression(self):
        """17. Priority endpoint and task details endpoint continue working cleanly."""
        self.assertIsNotNone(self.token)
        # Priority endpoint
        status, data = await asgi_request(
            app,
            "GET",
            "/api/v1/maintenance-tasks/WO-0001/priority",
            token=self.token,
        )
        self.assertEqual(status, 200)
        self.assertEqual(data["task_id"], "WO-0001")
        self.assertIn("computed_priority_score", data)

        # Task detail endpoint
        status, data = await asgi_request(
            app,
            "GET",
            "/api/v1/maintenance-tasks/WO-0001",
            token=self.token,
        )
        self.assertEqual(status, 200)
        self.assertEqual(data["task_id"], "WO-0001")


if __name__ == "__main__":
    unittest.main()
