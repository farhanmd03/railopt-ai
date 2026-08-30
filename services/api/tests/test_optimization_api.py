"""Integration test suite for public optimization API endpoints (Batch 6B.3).

Tests:
1. Anonymous POST /api/v1/optimization/runs -> 401 Unauthorized
2. VIEWER POST /api/v1/optimization/runs -> 403 Forbidden
3. ENGINEERING POST /api/v1/optimization/runs -> 403 Forbidden
4. PLANNER POST /api/v1/optimization/runs -> 201 Created
5. ADMIN POST /api/v1/optimization/runs -> 201 Created
6. CONTROL POST /api/v1/optimization/runs -> 201 Created
7. Full run payload response matches schema contracts
8. GET /api/v1/optimization/runs/{run_id} -> 200 OK with detailed blocks
9. GET /api/v1/optimization/runs/UNKNOWN-999 -> 404 Not Found
10. GET /api/v1/optimization/runs/{run_id}/blocks -> only blocks belonging to that run
11. GET /api/v1/optimization/runs/{run_id}/blocks pagination & filters
12. GET /api/v1/optimization/runs lists historical runs
13. realized_priority_value is populated and distinct from candidate_priority_value
14. Block status is 'Candidate' (distinguishing OPTIMAL solver output from APPROVED)
15. Anonymous GET requests -> 401 Unauthorized
"""

import asyncio
import json
import os
from pathlib import Path
import sys
import unittest
import urllib.parse
import urllib.request

import httpx
from sqlalchemy import select

API_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = API_DIR.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))
sys.path.insert(0, str(API_DIR))

if sys.platform == "win32":
    try:
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    except Exception:
        pass

from app.core.database import async_session_factory
from app.main import app
from app.models.optimization import OptimizationRun, OptimizedBlock

KEYCLOAK_URL = os.getenv("KEYCLOAK_URL", "http://127.0.0.1:8080").replace("localhost", "127.0.0.1").rstrip("/")
REALM = "railopt"
CLIENT_ID = "railopt-web"
DEMO_PASSWORD = os.getenv("DEMO_USER_PASSWORD", "railopt_demo_2026")


def obtain_token(username: str) -> str:
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


class TestOptimizationAPI(unittest.IsolatedAsyncioTestCase):
    """End-to-end HTTP API integration test suite for /api/v1/optimization endpoints."""

    @classmethod
    def setUpClass(cls):
        try:
            cls.planner_token = obtain_token("planner.demo")
            cls.admin_token = obtain_token("admin.demo")
            cls.control_token = obtain_token("control.demo")
            cls.viewer_token = obtain_token("viewer.demo")
            cls.engineering_token = obtain_token("engineering.demo")
        except Exception as e:
            print(f"Warning: Could not acquire Keycloak tokens: {e}")
            cls.planner_token = None
            cls.admin_token = None
            cls.control_token = None
            cls.viewer_token = None
            cls.engineering_token = None

    async def test_01_anonymous_post_runs_unauthorized(self):
        """1. Anonymous POST /api/v1/optimization/runs returns 401."""
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post("/api/v1/optimization/runs", json={})
            self.assertEqual(resp.status_code, 401)

    async def test_02_viewer_post_runs_forbidden(self):
        """2. VIEWER POST /api/v1/optimization/runs returns 403."""
        if not self.viewer_token:
            self.skipTest("Keycloak tokens not available")
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/api/v1/optimization/runs",
                json={},
                headers={"Authorization": f"Bearer {self.viewer_token}"},
            )
            self.assertEqual(resp.status_code, 403)

    async def test_03_engineering_post_runs_forbidden(self):
        """3. ENGINEERING POST /api/v1/optimization/runs returns 403."""
        if not self.engineering_token:
            self.skipTest("Keycloak tokens not available")
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/api/v1/optimization/runs",
                json={},
                headers={"Authorization": f"Bearer {self.engineering_token}"},
            )
            self.assertEqual(resp.status_code, 403)

    async def test_04_planner_post_runs_success(self):
        """4. PLANNER POST /api/v1/optimization/runs succeeds with 201 Created and persists run."""
        if not self.planner_token:
            self.skipTest("Keycloak tokens not available")
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            payload = {
                "run_type": "api_test_planner",
                "solver_time_limit_seconds": 10.0,
                "allow_train_conflicts": False,
            }
            resp = await client.post(
                "/api/v1/optimization/runs",
                json=payload,
                headers={"Authorization": f"Bearer {self.planner_token}"},
            )
            self.assertEqual(resp.status_code, 201)
            data = resp.json()

            # Verify response schema fields
            self.assertIn("id", data)
            self.assertIn("run_id", data)
            self.assertEqual(data["run_type"], "api_test_planner")
            self.assertEqual(data["solver_status"], "OPTIMAL")
            self.assertEqual(data["status"], "Completed")
            self.assertEqual(data["tasks_considered"], 53)
            self.assertEqual(data["tasks_scheduled"], 45)
            self.assertEqual(data["tasks_unassigned"], 8)
            self.assertEqual(data["integrated_block_count"], 15)
            self.assertEqual(data["separate_block_count"], 4)

            # Store for subsequent tests
            self.__class__.created_run_id = data["id"]
            self.__class__.created_domain_run_id = data["run_id"]

    async def test_05_admin_post_runs_success(self):
        """5. ADMIN POST /api/v1/optimization/runs succeeds with 201."""
        if not self.admin_token:
            self.skipTest("Keycloak tokens not available")
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/api/v1/optimization/runs",
                json={"run_type": "api_test_admin", "solver_time_limit_seconds": 5.0},
                headers={"Authorization": f"Bearer {self.admin_token}"},
            )
            self.assertEqual(resp.status_code, 201)

    async def test_06_control_post_runs_success(self):
        """6. CONTROL POST /api/v1/optimization/runs succeeds with 201."""
        if not self.control_token:
            self.skipTest("Keycloak tokens not available")
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/api/v1/optimization/runs",
                json={"run_type": "api_test_control", "solver_time_limit_seconds": 5.0},
                headers={"Authorization": f"Bearer {self.control_token}"},
            )
            self.assertEqual(resp.status_code, 201)

    async def test_07_get_run_by_id_success(self):
        """7. GET /api/v1/optimization/runs/{run_id} returns detailed run with scheduled blocks."""
        if not self.viewer_token:
            self.skipTest("Keycloak tokens not available")
        run_id = getattr(self.__class__, "created_run_id", None)
        if not run_id:
            # Fallback to query database for any existing run
            async with async_session_factory() as session:
                run_id = (await session.scalar(select(OptimizationRun.id).order_by(OptimizationRun.id.desc())))

        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get(
                f"/api/v1/optimization/runs/{run_id}",
                headers={"Authorization": f"Bearer {self.viewer_token}"},
            )
            self.assertEqual(resp.status_code, 200)
            data = resp.json()

            self.assertEqual(data["id"], run_id)
            self.assertIn("scheduled_blocks", data)
            self.assertEqual(len(data["scheduled_blocks"]), 19)

            first_block = data["scheduled_blocks"][0]
            self.assertIn("realized_priority_value", first_block)
            self.assertGreater(first_block["realized_priority_value"], 0.0)
            self.assertEqual(first_block["status"], "Candidate")  # Approval state separation

    async def test_08_get_run_unknown_404(self):
        """8. GET /api/v1/optimization/runs/999999 returns 404 Not Found."""
        if not self.viewer_token:
            self.skipTest("Keycloak tokens not available")
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get(
                "/api/v1/optimization/runs/999999",
                headers={"Authorization": f"Bearer {self.viewer_token}"},
            )
            self.assertEqual(resp.status_code, 404)

    async def test_09_get_run_blocks_pagination_and_filtering(self):
        """9. GET /api/v1/optimization/runs/{run_id}/blocks returns paginated blocks strictly for that run."""
        if not self.viewer_token:
            self.skipTest("Keycloak tokens not available")
        run_id = getattr(self.__class__, "created_run_id", None)
        if not run_id:
            async with async_session_factory() as session:
                run_id = (await session.scalar(select(OptimizationRun.id).order_by(OptimizationRun.id.desc())))

        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            # Query page 1 (size 10)
            resp = await client.get(
                f"/api/v1/optimization/runs/{run_id}/blocks?page=1&page_size=10",
                headers={"Authorization": f"Bearer {self.viewer_token}"},
            )
            self.assertEqual(resp.status_code, 200)
            data = resp.json()

            self.assertEqual(data["page"], 1)
            self.assertEqual(data["page_size"], 10)
            self.assertEqual(data["total"], 19)
            self.assertEqual(data["total_pages"], 2)
            self.assertEqual(len(data["items"]), 10)

            # Check that all items belong to this run
            for item in data["items"]:
                self.assertEqual(item["optimization_run_id"], run_id)
                self.assertIn("realized_priority_value", item)

            # Query page 2 (remaining 9)
            resp2 = await client.get(
                f"/api/v1/optimization/runs/{run_id}/blocks?page=2&page_size=10",
                headers={"Authorization": f"Bearer {self.viewer_token}"},
            )
            self.assertEqual(resp2.status_code, 200)
            data2 = resp2.json()
            self.assertEqual(len(data2["items"]), 9)

            # Filter by is_integrated=true
            resp_integrated = await client.get(
                f"/api/v1/optimization/runs/{run_id}/blocks?is_integrated=true",
                headers={"Authorization": f"Bearer {self.viewer_token}"},
            )
            self.assertEqual(resp_integrated.status_code, 200)
            data_int = resp_integrated.json()
            self.assertEqual(data_int["total"], 15)
            for item in data_int["items"]:
                self.assertTrue(item["is_integrated"])

    async def test_10_list_runs_pagination(self):
        """10. GET /api/v1/optimization/runs lists historical runs with pagination."""
        if not self.viewer_token:
            self.skipTest("Keycloak tokens not available")
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get(
                "/api/v1/optimization/runs?page=1&page_size=5",
                headers={"Authorization": f"Bearer {self.viewer_token}"},
            )
            self.assertEqual(resp.status_code, 200)
            data = resp.json()

            self.assertGreater(data["total"], 0)
            self.assertLessEqual(len(data["items"]), 5)
            first_run = data["items"][0]
            self.assertIn("solver_status", first_run)
            self.assertIn("tasks_scheduled", first_run)

    async def test_13_candidate_priority_value_distinct_from_realized(self):
        """13. candidate_priority_value is not null and diverges from realized_priority_value for integrated blocks."""
        if not self.viewer_token or not self.planner_token:
            self.skipTest("Keycloak tokens not available")

        # Create a real run to inspect scheduled blocks
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/api/v1/optimization/runs",
                json={"run_type": "priority_divergence_test", "solver_time_limit_seconds": 10.0},
                headers={"Authorization": f"Bearer {self.planner_token}"},
            )
            self.assertEqual(resp.status_code, 201)
            run_id = resp.json()["id"]

            detail_resp = await client.get(
                f"/api/v1/optimization/runs/{run_id}",
                headers={"Authorization": f"Bearer {self.viewer_token}"},
            )
            self.assertEqual(detail_resp.status_code, 200)
            blocks = detail_resp.json()["scheduled_blocks"]
            self.assertGreater(len(blocks), 0)

            # Check that every block has non-null candidate_priority_value
            for b in blocks:
                self.assertIsNotNone(
                    b["candidate_priority_value"],
                    f"Block {b['id']} has null candidate_priority_value",
                )

            # Find at least one integrated block (task_ids length > 1) and assert divergence
            integrated_blocks = [b for b in blocks if len(b["task_ids"]) > 1]
            self.assertGreater(len(integrated_blocks), 0)

            found_divergence = False
            for ib in integrated_blocks:
                if ib["candidate_priority_value"] != ib["realized_priority_value"]:
                    found_divergence = True
                    break

            self.assertTrue(
                found_divergence,
                "Expected candidate_priority_value to diverge from realized_priority_value on integrated blocks",
            )

    async def test_18_explicit_zero_weight_is_respected(self):
        """18. Explicit weight override of 0.0 is respected and not replaced by default weight."""
        if not self.planner_token:
            self.skipTest("Keycloak tokens not available")

        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/api/v1/optimization/runs",
                json={
                    "run_type": "zero_weight_test",
                    "solver_time_limit_seconds": 5.0,
                    "weight_overdue_mitigation": 0.0,
                },
                headers={"Authorization": f"Bearer {self.planner_token}"},
            )
            self.assertEqual(resp.status_code, 201)
            run_id = resp.json()["id"]

            # Query database directly to inspect stored parameters JSON
            async with async_session_factory() as session:
                db_run = await session.get(OptimizationRun, run_id)
                self.assertIsNotNone(db_run)
                self.assertIsNotNone(db_run.parameters)
                param_dict = json.loads(db_run.parameters)
                stored_weights = param_dict.get("weights", {})
                self.assertEqual(
                    stored_weights.get("weight_overdue_mitigation"),
                    0.0,
                    f"Expected weight_overdue_mitigation=0.0, got {stored_weights.get('weight_overdue_mitigation')}",
                )


if __name__ == "__main__":
    unittest.main()
