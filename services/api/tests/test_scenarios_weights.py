# Regression tests for explicit weight handling in What-If scenarios

import asyncio
import json
import os
import sys
from pathlib import Path
import urllib.parse
import urllib.request

import httpx
from sqlalchemy import select

# Adjust sys.path for imports
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
from app.models.optimization import OptimizationRun, OptimizationScenario
from app.services.optimization_service import OptimizationService

# Environment variables for Keycloak (same as other tests)
KEYCLOAK_URL = os.getenv("KEYCLOAK_URL", "http://127.0.0.1:8080").replace("localhost", "127.0.0.1").rstrip("/")
REALM = "railopt"
CLIENT_ID = "railopt-web"
DEMO_PASSWORD = os.getenv("DEMO_USER_PASSWORD", "railopt_demo_2026")


def obtain_token(username: str) -> str:
    """Acquire a JWT access token from Keycloak for testing."""
    url = f"{KEYCLOAK_URL}/realms/{REALM}/protocol/openid-connect/token"
    data = urllib.parse.urlencode({
        "client_id": CLIENT_ID,
        "username": username,
        "password": DEMO_PASSWORD,
        "grant_type": "password",
        "scope": "openid profile email",
    }).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/x-www-form-urlencoded"}, method="POST")
    with urllib.request.urlopen(req, timeout=10) as resp:
        res = json.loads(resp.read().decode("utf-8"))
        return res["access_token"]


class TestScenarioWeightHandling:
    """Regression tests verifying weight handling logic for What‑If scenarios."""

    @classmethod
    def setUpClass(cls):
        try:
            cls.planner_token = obtain_token("planner.demo")
            cls.keycloak_available = True
        except Exception as e:
            cls.keycloak_available = False
            print(f"Keycloak not reachable: {e}. Skipping weight‑handling tests.")

    async def asyncSetUp(self):
        if not self.keycloak_available:
            self.skipTest("Keycloak auth server unavailable")
        # Create a fresh base optimisation run.
        async with async_session_factory() as session:
            base_run, _ = await OptimizationService.run_and_persist_optimization(db=session, run_type="standard")
            self.base_run_id = base_run.id

    async def _create_scenario(self, payload: dict) -> dict:
        headers = {"Authorization": f"Bearer {self.planner_token}"}
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                f"/api/v1/optimization/runs/{self.base_run_id}/scenarios",
                headers=headers,
                json=payload,
                timeout=30.0,
            )
            assert resp.status_code == 201, f"Unexpected status {resp.status_code}: {resp.text}"
            return resp.json()

    async def test_omitted_weights_use_defaults(self):
        """When no weight fields are supplied, defaults are applied."""
        payload = {"name": "Omitted Weights", "scenario_type": "OBJECTIVE_WEIGHTS"}
        data = await self._create_scenario(payload)
        async with async_session_factory() as session:
            scenario = await session.get(OptimizationScenario, data["scenario_id"])
            assert scenario.weight_priority_score == 1.0
            assert scenario.weight_train_disruption == 8.0
            assert scenario.weight_unused_window_time == 0.5

    async def test_explicit_zero_weight_is_preserved(self):
        """Explicit 0.0 should not be replaced by the default."""
        payload = {
            "name": "Zero Weight Test",
            "scenario_type": "OBJECTIVE_WEIGHTS",
            "weight_train_disruption": 0.0,
            "weight_unused_window_time": 0.0,
        }
        data = await self._create_scenario(payload)
        async with async_session_factory() as session:
            scenario = await session.get(OptimizationScenario, data["scenario_id"])
            assert scenario.weight_train_disruption == 0.0
            assert scenario.weight_unused_window_time == 0.0

    async def test_custom_positive_weights(self):
        """Custom positive values should be stored unchanged."""
        payload = {
            "name": "Custom Weights",
            "scenario_type": "OBJECTIVE_WEIGHTS",
            "weight_priority_score": 2.5,
            "weight_integrated_task_bonus": 15.0,
            "weight_train_disruption": 12.0,
        }
        data = await self._create_scenario(payload)
        async with async_session_factory() as session:
            scenario = await session.get(OptimizationScenario, data["scenario_id"])
            assert scenario.weight_priority_score == 2.5
            assert scenario.weight_integrated_task_bonus == 15.0
            assert scenario.weight_train_disruption == 12.0
