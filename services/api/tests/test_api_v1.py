"""Test suite for RailOpt AI API v1 endpoints.

Uses Python standard library (urllib / asyncio) against the running FastAPI app.
"""

import asyncio
import json
import sys
import unittest
from urllib.error import HTTPError
import urllib.request

# Ensure path
import sys
from pathlib import Path
API_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = API_DIR.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))
sys.path.insert(0, str(API_DIR))

BASE_URL = "http://127.0.0.1:8000"


def http_get(path: str) -> tuple[int, dict]:
    """Helper to perform HTTP GET and parse JSON."""
    url = f"{BASE_URL}{path}"
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return resp.status, data
    except HTTPError as exc:
        data = json.loads(exc.read().decode("utf-8"))
        return exc.code, data


class TestApiV1(unittest.TestCase):
    """Test suite covering all required API endpoints."""

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

    def test_11_maintenance_tasks_list(self):
        """11. GET /api/v1/maintenance-tasks returns tasks (total=53)."""
        status, data = http_get("/api/v1/maintenance-tasks?page_size=100")
        self.assertEqual(status, 200)
        self.assertEqual(data["total"], 53)
        self.assertEqual(len(data["items"]), 53)

    def test_12_maintenance_tasks_department_filter(self):
        """12. GET /api/v1/maintenance-tasks?department=S%26T filters properly."""
        status, data = http_get("/api/v1/maintenance-tasks?department=S%26T")
        self.assertEqual(status, 200)
        self.assertGreater(data["total"], 0)
        for item in data["items"]:
            self.assertEqual(item["department"], "S&T")

    def test_13_maintenance_tasks_severity_filter(self):
        """13. GET /api/v1/maintenance-tasks?severity=Critical filters properly."""
        status, data = http_get("/api/v1/maintenance-tasks?severity=Critical")
        self.assertEqual(status, 200)
        self.assertGreater(data["total"], 0)
        for item in data["items"]:
            self.assertEqual(item["severity"], "Critical")

    def test_14_maintenance_tasks_get_valid_and_invalid(self):
        """14. GET /api/v1/maintenance-tasks/{task_id} valid and 404."""
        status, data = http_get("/api/v1/maintenance-tasks/WO-0001")
        self.assertEqual(status, 200)
        self.assertEqual(data["task_id"], "WO-0001")

        status, data = http_get("/api/v1/maintenance-tasks/TSK-99999")
        self.assertEqual(status, 404)

    def test_15_pagination(self):
        """15. Pagination metadata and slices work accurately."""
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

    def test_16_validation_error_page_params(self):
        """16. Invalid page/page_size triggers 422 Unprocessable Entity."""
        status, data = http_get("/api/v1/assets?page=0")
        self.assertEqual(status, 422)

        status, data = http_get("/api/v1/assets?page_size=500")  # max is 100
        self.assertEqual(status, 422)


if __name__ == "__main__":
    unittest.main()
