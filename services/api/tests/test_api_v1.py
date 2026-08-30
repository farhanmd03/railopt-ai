"""Test suite for RailOpt AI API v1 endpoints.

Uses Python standard library (urllib / asyncio) against the running FastAPI app.
"""

import json
import os
from pathlib import Path
import sys
import unittest
from urllib.error import HTTPError
import urllib.parse
import urllib.request

API_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = API_DIR.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))
sys.path.insert(0, str(API_DIR))

BASE_URL = "http://127.0.0.1:8000"
KEYCLOAK_URL = os.getenv("KEYCLOAK_URL", "http://127.0.0.1:8080").rstrip("/")
REALM = "railopt"
CLIENT_ID = "railopt-web"
DEMO_PASSWORD = os.getenv("DEMO_USER_PASSWORD", "railopt_demo_2026")


def obtain_demo_token(username: str = "engineering.demo") -> str:
    """Acquire real JWT access token from Keycloak for demo testing."""
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


def http_get(path: str, token: str | None = None) -> tuple[int, dict]:
    """Helper to perform HTTP GET and parse JSON."""
    url = f"{BASE_URL}{path}"
    headers = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return resp.status, data
    except HTTPError as exc:
        data = json.loads(exc.read().decode("utf-8"))
        return exc.code, data


class TestApiV1(unittest.TestCase):
    """Test suite covering all required API endpoints."""

    @classmethod
    def setUpClass(cls):
        try:
            cls.token = obtain_demo_token("engineering.demo")
        except Exception:
            cls.token = None

    def test_01_health_endpoints(self):
        """1. GET /health and /health/db still work."""
        status, data = http_get("/health")
        self.assertEqual(status, 200)
        self.assertEqual(data["status"], "ok")

        status, data = http_get("/health/db")
        self.assertEqual(status, 200)
        self.assertEqual(data["status"], "ok")
        self.assertEqual(data["database"], "connected")

    def test_02_sections_list(self):
        """2. GET /api/v1/sections returns paginated sections (total=9)."""
        status, data = http_get("/api/v1/sections")
        self.assertEqual(status, 200)
        self.assertEqual(data["total"], 9)
        self.assertEqual(len(data["items"]), 9)
        self.assertEqual(data["page"], 1)
        self.assertEqual(data["total_pages"], 1)

    def test_03_sections_get_valid(self):
        """3. GET /api/v1/sections/{valid_id} returns the section."""
        status, data = http_get("/api/v1/sections/HOW_SEC_001")
        self.assertEqual(status, 200)
        self.assertEqual(data["section_id"], "HOW_SEC_001")
        self.assertEqual(data["from_station_code"], "HWH")
        self.assertEqual(data["to_station_code"], "DKAE")

    def test_04_sections_get_invalid_404(self):
        """4. GET /api/v1/sections/{invalid_id} returns 404."""
        status, data = http_get("/api/v1/sections/INVALID_SEC_999")
        self.assertEqual(status, 404)
        self.assertIn("detail", data)

    def test_05_stations_list(self):
        """5. GET /api/v1/stations returns paginated stations (total=37)."""
        status, data = http_get("/api/v1/stations?page_size=50")
        self.assertEqual(status, 200)
        self.assertEqual(data["total"], 37)
        self.assertEqual(len(data["items"]), 37)

    def test_06_stations_get_valid(self):
        """6. GET /api/v1/stations/{station_code} returns station details."""
        status, data = http_get("/api/v1/stations/HWH")
        self.assertEqual(status, 200)
        self.assertEqual(data["station_code"], "HWH")
        self.assertEqual(data["station_name"], "Howrah Junction")

    def test_07_stations_filter_by_section(self):
        """7. GET /api/v1/stations?section_id=HOW_SEC_001 returns mapped stations."""
        status, data = http_get("/api/v1/stations?section_id=HOW_SEC_001")
        self.assertEqual(status, 200)
        self.assertEqual(data["total"], 6)  # HWH, LLH, BEQ, BLYC, BZL, DKAE
        codes = [s["station_code"] for s in data["items"]]
        self.assertIn("HWH", codes)
        self.assertIn("DKAE", codes)

    def test_08_assets_list(self):
        """8. GET /api/v1/assets returns paginated assets (total=101)."""
        status, data = http_get("/api/v1/assets?page_size=100")
        self.assertEqual(status, 200)
        self.assertEqual(data["total"], 101)
        self.assertEqual(len(data["items"]), 100)

    def test_09_assets_filters(self):
        """9. GET /api/v1/assets with department and asset_type filters."""
        status, data = http_get("/api/v1/assets?department=Engineering&asset_type=Track")
        self.assertEqual(status, 200)
        self.assertGreater(data["total"], 0)
        for item in data["items"]:
            self.assertEqual(item["department"], "Engineering")
            self.assertEqual(item["asset_type"], "Track")

    def test_10_assets_get_valid_and_invalid(self):
        """10. GET /api/v1/assets/{asset_id} valid and 404."""
        status, data = http_get("/api/v1/assets/TRK-HWH-01")
        self.assertEqual(status, 200)
        self.assertEqual(data["asset_id"], "TRK-HWH-01")

        status, data = http_get("/api/v1/assets/NON_EXISTENT_AST")
        self.assertEqual(status, 404)

    def test_11_maintenance_tasks_unauthenticated_401(self):
        """11. GET /api/v1/maintenance-tasks without token returns 401."""
        status, data = http_get("/api/v1/maintenance-tasks")
        self.assertEqual(status, 401)
        self.assertIn("detail", data)

    def test_12_maintenance_tasks_list_authenticated(self):
        """12. GET /api/v1/maintenance-tasks with valid token returns tasks (total=53)."""
        self.assertIsNotNone(self.token, "Keycloak demo token required for this test")
        status, data = http_get("/api/v1/maintenance-tasks?page_size=100", token=self.token)
        self.assertEqual(status, 200)
        self.assertEqual(data["total"], 53)
        self.assertEqual(len(data["items"]), 53)

    def test_13_maintenance_tasks_department_filter(self):
        """13. GET /api/v1/maintenance-tasks?department=S%26T filters properly."""
        self.assertIsNotNone(self.token)
        status, data = http_get("/api/v1/maintenance-tasks?department=S%26T", token=self.token)
        self.assertEqual(status, 200)
        self.assertGreater(data["total"], 0)
        for item in data["items"]:
            self.assertEqual(item["department"], "S&T")

    def test_14_maintenance_tasks_severity_filter(self):
        """14. GET /api/v1/maintenance-tasks?severity=Critical filters properly."""
        self.assertIsNotNone(self.token)
        status, data = http_get("/api/v1/maintenance-tasks?severity=Critical", token=self.token)
        self.assertEqual(status, 200)
        self.assertGreater(data["total"], 0)
        for item in data["items"]:
            self.assertEqual(item["severity"], "Critical")

    def test_15_maintenance_tasks_get_valid_and_invalid(self):
        """15. GET /api/v1/maintenance-tasks/{task_id} valid and 404."""
        self.assertIsNotNone(self.token)
        status, data = http_get("/api/v1/maintenance-tasks/WO-0001", token=self.token)
        self.assertEqual(status, 200)
        self.assertEqual(data["task_id"], "WO-0001")

        status, data = http_get("/api/v1/maintenance-tasks/TSK-99999", token=self.token)
        self.assertEqual(status, 404)

    def test_16_pagination(self):
        """16. Pagination metadata and slices work accurately."""
        status, data = http_get("/api/v1/assets?page=1&page_size=10")
        self.assertEqual(status, 200)
        self.assertEqual(data["total"], 101)
        self.assertEqual(data["page"], 1)
        self.assertEqual(data["page_size"], 10)
        self.assertEqual(data["total_pages"], 11)
        self.assertEqual(len(data["items"]), 10)

        # Page 11 should have 1 item (101 - 100)
        status, data2 = http_get("/api/v1/assets?page=11&page_size=10")
        self.assertEqual(status, 200)
        self.assertEqual(len(data2["items"]), 1)

    def test_18_maintenance_task_priority_authenticated(self):
        """18. GET /api/v1/maintenance-tasks/{task_id}/priority returns deterministic assessment."""
        self.assertIsNotNone(self.token)
        status, data = http_get("/api/v1/maintenance-tasks/WO-0001/priority", token=self.token)
        self.assertEqual(status, 200)
        self.assertEqual(data["task_id"], "WO-0001")
        self.assertIn("computed_priority_score", data)
        self.assertIn("baseline_priority_score", data)
        self.assertIn("priority_band", data)
        self.assertIn("components", data)
        self.assertIn("reasons", data)
        self.assertIsInstance(data["reasons"], list)

    def test_19_maintenance_task_priority_unauthenticated(self):
        """19. GET /api/v1/maintenance-tasks/{task_id}/priority without token returns 401."""
        status, data = http_get("/api/v1/maintenance-tasks/WO-0001/priority")
        self.assertEqual(status, 401)

    def test_20_integration_opportunities_list_authenticated(self):
        """20. GET /api/v1/maintenance-tasks/integration-opportunities returns opportunities list."""
        self.assertIsNotNone(self.token)
        status, data = http_get("/api/v1/maintenance-tasks/integration-opportunities?cross_department=true", token=self.token)
        self.assertEqual(status, 200)
        self.assertIn("items", data)
        self.assertIn("total", data)
        self.assertGreater(data["total"], 0)

    def test_21_task_integration_opportunities_authenticated(self):
        """21. GET /api/v1/maintenance-tasks/{task_id}/integration-opportunities returns task opps."""
        self.assertIsNotNone(self.token)
        status, data = http_get("/api/v1/maintenance-tasks/WO-0001/integration-opportunities", token=self.token)
        self.assertEqual(status, 200)
        self.assertIsInstance(data, list)

    def test_22_candidate_blocks_list_authenticated(self):
        """22. GET /api/v1/candidate-blocks returns candidate blocks."""
        self.assertIsNotNone(self.token)
        status, data = http_get("/api/v1/candidate-blocks?section_id=HOW_SEC_001&page_size=5", token=self.token)
        self.assertEqual(status, 200)
        self.assertIn("items", data)
        self.assertIn("total", data)
        self.assertGreater(data["total"], 0)

    def test_23_candidate_blocks_unauthenticated_401(self):
        """23. GET /api/v1/candidate-blocks without token returns 401."""
        status, data = http_get("/api/v1/candidate-blocks")
        self.assertEqual(status, 401)

    def test_24_optimization_runs_list_authenticated(self):
        """24. GET /api/v1/optimization/runs returns historical runs."""
        self.assertIsNotNone(self.token)
        status, data = http_get("/api/v1/optimization/runs?page=1&page_size=5", token=self.token)
        self.assertEqual(status, 200)
        self.assertIn("items", data)
        self.assertIn("total", data)

    def test_25_optimization_runs_unauthenticated_401(self):
        """25. GET /api/v1/optimization/runs without token returns 401."""
        status, data = http_get("/api/v1/optimization/runs")
        self.assertEqual(status, 401)


if __name__ == "__main__":
    unittest.main()
