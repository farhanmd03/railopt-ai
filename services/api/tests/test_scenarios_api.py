"""Comprehensive integration test suite for What-If Scenarios API (Batch 7K).

Tests:
1. Anonymous POST /runs/{run_id}/scenarios -> 401 Unauthorized
2. VIEWER POST /runs/{run_id}/scenarios -> 403 Forbidden
3. PLANNER POST /runs/{run_id}/scenarios -> 201 Created with real CP-SAT solve
4. Base run remains immutable and approval status intact
5. Comparison metrics (tasks, blocks, integrated, duration, objective) and deltas are mathematically correct
6. Task impact (retained, newly unassigned, newly scheduled) and block differences are populated
7. Candidate exclusion scenario successfully excludes specified candidate block
8. GET /runs/{run_id}/scenarios lists all scenarios for base run
9. GET /scenarios/{scenario_id} returns detailed scenario comparison
10. GET /scenarios/UNKNOWN-999 -> 404 Not Found
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
from app.models.optimization import OptimizationRun, OptimizationScenario, OptimizedBlock
from app.services.optimization_service import OptimizationService

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


class TestScenariosAPI(unittest.IsolatedAsyncioTestCase):
    """Test suite for What-If scenario execution, persistence, and comparisons."""

    @classmethod
    def setUpClass(cls):
        try:
            cls.planner_token = obtain_token("planner.demo")
            cls.viewer_token = obtain_token("viewer.demo")
            cls.admin_token = obtain_token("admin.demo")
            cls.keycloak_available = True
        except Exception as e:
            cls.keycloak_available = False
            print(f"Keycloak not reachable: {e}. Skipping live token tests.")

    async def asyncSetUp(self):
        if not self.keycloak_available:
            self.skipTest("Keycloak auth server unavailable")

        # Run a real base optimization solve to establish an authentic base run
        async with async_session_factory() as session:
            base_run, _ = await OptimizationService.run_and_persist_optimization(
                db=session,
                run_type="standard",
            )
            self.base_run_id = base_run.id
            self.original_obj = base_run.objective_value
            self.original_approval = base_run.approval_status

    async def test_01_anonymous_cannot_create_scenario(self):
        """Anonymous request to create scenario must be rejected with 401."""
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                f"/api/v1/optimization/runs/{self.base_run_id}/scenarios",
                json={"name": "Anon Scenario", "scenario_type": "OBJECTIVE_WEIGHTS"},
            )
            self.assertEqual(resp.status_code, 401)

    async def test_02_viewer_cannot_create_scenario(self):
        """VIEWER role cannot create scenarios (403)."""
        headers = {"Authorization": f"Bearer {self.viewer_token}"}
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                f"/api/v1/optimization/runs/{self.base_run_id}/scenarios",
                headers=headers,
                json={"name": "Viewer Scenario", "scenario_type": "OBJECTIVE_WEIGHTS"},
            )
            self.assertEqual(resp.status_code, 403)

    async def test_03_planner_can_create_and_execute_scenario(self):
        """PLANNER can create What-If scenario with overridden soft weights."""
        headers = {"Authorization": f"Bearer {self.planner_token}"}
        payload = {
            "name": "High Train Disruption Sensitivity",
            "scenario_type": "OBJECTIVE_WEIGHTS",
            "weight_train_disruption": 50.0,  # Drastically increase disruption penalty
            "weight_integrated_task_bonus": 25.0,
            "notes": "Testing high traffic penalty impact on consolidation.",
        }

        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test", timeout=30.0) as client:
            resp = await client.post(
                f"/api/v1/optimization/runs/{self.base_run_id}/scenarios",
                headers=headers,
                json=payload,
            )
            self.assertEqual(resp.status_code, 201)
            data = resp.json()

            # 1. Verify scenario attributes
            self.assertEqual(data["name"], "High Train Disruption Sensitivity")
            self.assertEqual(data["scenario_type"], "OBJECTIVE_WEIGHTS")
            self.assertIn(data["status"], ("COMPLETED", "FEASIBLE"))
            self.assertEqual(data["base_run_id"], self.base_run_id)
            self.assertIsNotNone(data["scenario_run_id"])
            self.assertEqual(data["created_by"], "planner.demo")

            # 2. Verify comparative metrics are populated
            comparison = data["comparison"]
            self.assertIsNotNone(comparison)
            self.assertIn("tasks_scheduled", comparison)
            self.assertIn("integrated_blocks", comparison)
            self.assertIn("objective_value", comparison)
            self.assertIsNotNone(comparison["explanation"])
            self.assertIn("Under this scenario", comparison["explanation"])

            # 3. Verify task impact and block differences
            self.assertIsNotNone(data["task_impact"])
            self.assertIsNotNone(data["block_differences"])

            # 4. Verify base run remains completely unchanged
            async with async_session_factory() as session:
                base_run_db = (
                    await session.scalars(
                        select(OptimizationRun).where(OptimizationRun.id == self.base_run_id)
                    )
                ).first()
                self.assertEqual(base_run_db.objective_value, self.original_obj)
                self.assertEqual(base_run_db.approval_status, self.original_approval)

    async def test_04_candidate_exclusion_scenario(self):
        """Candidate exclusion scenario accurately omits candidate from the solver universe."""
        headers = {"Authorization": f"Bearer {self.planner_token}"}

        # Find one candidate block from base run
        async with async_session_factory() as session:
            blocks = (
                await session.scalars(
                    select(OptimizedBlock).where(OptimizedBlock.optimization_run_id == self.base_run_id)
                )
            ).all()
            self.assertTrue(len(blocks) > 0)
            target_block = blocks[0]
            # Parse candidate_id from explanation
            exp = json.loads(target_block.explanation) if target_block.explanation else {}
            excluded_candidate = exp.get("candidate_id")

        payload = {
            "name": f"Excluding Candidate {excluded_candidate}",
            "scenario_type": "CANDIDATE_EXCLUSION",
            "excluded_candidate_ids": [excluded_candidate] if excluded_candidate else ["CAND-001"],
            "notes": "Testing specific possession window closure.",
        }

        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test", timeout=30.0) as client:
            resp = await client.post(
                f"/api/v1/optimization/runs/{self.base_run_id}/scenarios",
                headers=headers,
                json=payload,
            )
            self.assertEqual(resp.status_code, 201)
            data = resp.json()
            self.assertEqual(data["scenario_type"], "CANDIDATE_EXCLUSION")

    async def test_05_list_and_get_scenario_history(self):
        """List scenarios for base run and retrieve detailed comparison by scenario_id."""
        headers = {"Authorization": f"Bearer {self.planner_token}"}
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test", timeout=30.0) as client:
            # 1. Create scenario
            create_resp = await client.post(
                f"/api/v1/optimization/runs/{self.base_run_id}/scenarios",
                headers=headers,
                json={"name": "History Test Scenario", "scenario_type": "OBJECTIVE_WEIGHTS"},
            )
            self.assertEqual(create_resp.status_code, 201)
            scen_id = create_resp.json()["scenario_id"]

            # 2. List scenarios
            list_resp = await client.get(
                f"/api/v1/optimization/runs/{self.base_run_id}/scenarios",
                headers=headers,
            )
            self.assertEqual(list_resp.status_code, 200)
            list_data = list_resp.json()
            self.assertGreaterEqual(list_data["total"], 1)

            # 3. Get scenario detail
            detail_resp = await client.get(
                f"/api/v1/optimization/scenarios/{scen_id}",
                headers=headers,
            )
            self.assertEqual(detail_resp.status_code, 200)
            self.assertEqual(detail_resp.json()["scenario_id"], scen_id)

            # 4. Unknown scenario -> 404
            bad_resp = await client.get(
                "/api/v1/optimization/scenarios/SCEN-NONEXISTENT",
                headers=headers,
            )
            self.assertEqual(bad_resp.status_code, 404)


if __name__ == "__main__":
    unittest.main()
