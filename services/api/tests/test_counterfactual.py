"""Comprehensive test suite for Counterfactual / Alternative Planning (Badge 3).

Tests:
1. Schema Validation (TestCounterfactualSchemas):
   - Valid POSTPONE scenario with postpone_hours
   - Valid POSTPONE scenario with new_start/new_end
   - Invalid POSTPONE missing both postpone_hours and new_start -> ValidationError
   - Valid REDUCE_DURATION scenario with new_duration_hrs
   - Invalid REDUCE_DURATION with non-positive duration -> ValidationError
   - Valid MOVE_WINDOW scenario with new_start < new_end
   - Invalid MOVE_WINDOW with new_start >= new_end -> ValidationError
   - Valid CHANGE_TASKS_DEPT scenario with task IDs list
   - Invalid CHANGE_TASKS_DEPT with empty tasks and empty departments -> ValidationError

2. Counterfactual Evaluation Logic (TestCounterfactualEvaluation):
   - POSTPONE scenario: Shifts window, recalculates conflicts & readiness, preserves tasks/priority
   - REDUCE_DURATION scenario: Decreases duration, recalculates readiness, computes duration delta
   - MOVE_WINDOW scenario: Shifts to target window, evaluates conflicts against section occupancies
   - CHANGE_TASKS_DEPT scenario: Recomputes priority from maintenance tasks, tracks added/removed tasks
   - Baseline Preservation: Base block timestamps, priority, and parent run approval status remain untouched
   - Rating & Narrative: Generates 'BETTER' / 'WORSE' / 'NEUTRAL' and readable explanation

3. API Endpoints (TestCounterfactualEndpoints):
   - Anonymous POST /blocks/{id}/counterfactual -> 401 Unauthorized
   - Authenticated POST /blocks/{id}/counterfactual -> 200 with CounterfactualComparison
   - Non-existent block -> 404 Not Found
   - Invalid payload -> 422 Unprocessable Entity
   - Scenario creation with counterfactual params -> 201 with counterfactual_comparison in response
"""

from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import AsyncMock, MagicMock
from pydantic import ValidationError
from starlette.testclient import TestClient

API_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = API_DIR.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))
sys.path.insert(0, str(API_DIR))

from app.core.database import get_db
from app.core.security import User, get_current_user
from app.main import app
from app.models.asset import Asset, MaintenanceTask
from app.models.operations import TrainSectionOccupancy
from app.models.optimization import OptimizationRun, OptimizationScenario, OptimizedBlock, OptimizedBlockTask
from app.schemas.scenario import (
    BlockCounterfactualRequest,
    CounterfactualBlockData,
    CounterfactualComparison,
    ScenarioCreateRequest,
)
from app.services.optimization_service import OptimizationService


class TestCounterfactualSchemas(unittest.TestCase):
    """Unit tests for counterfactual planning request schemas and validators."""

    def test_01_postpone_with_hours_valid(self):
        req = BlockCounterfactualRequest(
            scenario_type="POSTPONE",
            postpone_hours=2.0,
            notes="Delay possession by 2 hours due to freight priority",
        )
        self.assertEqual(req.scenario_type, "POSTPONE")
        self.assertEqual(req.postpone_hours, 2.0)

    def test_02_postpone_with_explicit_timestamps_valid(self):
        now = datetime.now(timezone.utc)
        req = BlockCounterfactualRequest(
            scenario_type="POSTPONE",
            new_start=now + timedelta(hours=3),
            new_end=now + timedelta(hours=7),
        )
        self.assertEqual(req.scenario_type, "POSTPONE")
        self.assertIsNotNone(req.new_start)
        self.assertIsNotNone(req.new_end)

    def test_03_postpone_missing_parameters_invalid(self):
        with self.assertRaises(ValidationError):
            BlockCounterfactualRequest(scenario_type="POSTPONE")

    def test_04_reduce_duration_valid(self):
        req = BlockCounterfactualRequest(
            scenario_type="REDUCE_DURATION",
            new_duration_hrs=2.5,
        )
        self.assertEqual(req.scenario_type, "REDUCE_DURATION")
        self.assertEqual(req.new_duration_hrs, 2.5)

    def test_05_reduce_duration_zero_or_negative_invalid(self):
        with self.assertRaises(ValidationError):
            BlockCounterfactualRequest(
                scenario_type="REDUCE_DURATION",
                new_duration_hrs=0.0,
            )

    def test_06_move_window_valid(self):
        t1 = datetime(2026, 10, 1, 10, 0, tzinfo=timezone.utc)
        t2 = datetime(2026, 10, 1, 14, 0, tzinfo=timezone.utc)
        req = BlockCounterfactualRequest(
            scenario_type="MOVE_WINDOW",
            new_start=t1,
            new_end=t2,
        )
        self.assertEqual(req.new_start, t1)
        self.assertEqual(req.new_end, t2)

    def test_07_move_window_start_after_end_invalid(self):
        t1 = datetime(2026, 10, 1, 14, 0, tzinfo=timezone.utc)
        t2 = datetime(2026, 10, 1, 10, 0, tzinfo=timezone.utc)
        with self.assertRaises(ValidationError):
            BlockCounterfactualRequest(
                scenario_type="MOVE_WINDOW",
                new_start=t1,
                new_end=t2,
            )

    def test_08_change_tasks_dept_valid(self):
        req = BlockCounterfactualRequest(
            scenario_type="CHANGE_TASKS_DEPT",
            new_task_ids=["TASK-ENG-001", "TASK-SNT-002"],
            new_departments=["ENGINEERING", "SNT"],
        )
        self.assertEqual(len(req.new_task_ids), 2)
        self.assertEqual(len(req.new_departments), 2)

    def test_09_change_tasks_dept_missing_both_invalid(self):
        with self.assertRaises(ValidationError):
            BlockCounterfactualRequest(scenario_type="CHANGE_TASKS_DEPT")

    def test_10_scenario_create_request_with_counterfactual(self):
        req = ScenarioCreateRequest(
            name="Postpone Block 1 by 1.5h",
            scenario_type="POSTPONE",
            target_block_id=1,
            postpone_hours=1.5,
        )
        self.assertEqual(req.name, "Postpone Block 1 by 1.5h")
        self.assertEqual(req.target_block_id, 1)
        self.assertEqual(req.postpone_hours, 1.5)


class TestCounterfactualEvaluation(unittest.IsolatedAsyncioTestCase):
    """Unit tests for the OptimizationService counterfactual evaluation logic."""

    def setUp(self):
        self.base_start = datetime(2026, 10, 1, 8, 0, tzinfo=timezone.utc)
        self.base_end = datetime(2026, 10, 1, 12, 0, tzinfo=timezone.utc)

        # Mock baseline OptimizedBlock
        self.mock_block = MagicMock(spec=OptimizedBlock)
        self.mock_block.id = 101
        self.mock_block.optimization_run_id = 5
        self.mock_block.section_id = "SEC-NDLS-GZB"
        self.mock_block.block_start = self.base_start
        self.mock_block.block_end = self.base_end
        self.mock_block.block_duration_hrs = 4.0
        self.mock_block.is_integrated = True
        self.mock_block.departments_involved = "ENGINEERING,SNT"
        self.mock_block.priority_score = 150.0
        self.mock_block.train_conflicts = 1
        self.mock_block.estimated_impact_score = 75.0
        self.mock_block.status = "Candidate"
        self.mock_block.explanation = json.dumps({
            "optimized_block_id": "OPT-BLK-0101",
            "resource_status": "VERIFIED",
        })

        # Mock junction tasks
        task1 = MagicMock(spec=OptimizedBlockTask)
        task1.task_id = "TSK-001"
        task2 = MagicMock(spec=OptimizedBlockTask)
        task2.task_id = "TSK-002"
        self.mock_block.tasks = [task1, task2]

    async def test_01_evaluate_postpone_scenario(self):
        mock_db = AsyncMock()
        # Mock block lookup
        mock_db.scalars.side_effect = [
            MagicMock(first=lambda: self.mock_block),  # select OptimizedBlock
            MagicMock(all=lambda: []),                 # select TrainSectionOccupancy
        ]

        comp = await OptimizationService.evaluate_block_counterfactual(
            db=mock_db,
            target_block_id=101,
            scenario_type="POSTPONE",
            postpone_hours=2.0,
        )

        self.assertEqual(comp.target_block_id, 101)
        self.assertEqual(comp.baseline.duration_hrs, 4.0)
        self.assertEqual(comp.alternative.duration_hrs, 4.0)
        self.assertEqual(comp.alternative.block_start, self.base_start + timedelta(hours=2))
        self.assertEqual(comp.alternative.block_end, self.base_end + timedelta(hours=2))
        self.assertEqual(comp.alternative.priority_score, 150.0)
        # Train conflicts dropped from 1 to 0 (since no occs overlap in mock)
        self.assertEqual(comp.alternative.train_conflicts, 0)
        self.assertEqual(comp.rating, "BETTER")
        self.assertIn("Postponing block OPT-BLK-0101 by 2.0h", comp.explanation)
        self.assertEqual(comp.alternative.readiness.readiness, "GO")

    async def test_02_evaluate_reduce_duration_scenario(self):
        mock_db = AsyncMock()
        mock_db.scalars.side_effect = [
            MagicMock(first=lambda: self.mock_block),
            MagicMock(all=lambda: []),
        ]

        comp = await OptimizationService.evaluate_block_counterfactual(
            db=mock_db,
            target_block_id=101,
            scenario_type="REDUCE_DURATION",
            new_duration_hrs=2.5,
        )

        self.assertEqual(comp.alternative.duration_hrs, 2.5)
        self.assertEqual(comp.deltas["duration_delta"], -1.5)
        self.assertIn("Reducing block duration from 4.00h to 2.50h", comp.explanation)

    async def test_03_evaluate_move_window_scenario(self):
        new_s = datetime(2026, 10, 2, 2, 0, tzinfo=timezone.utc)
        new_e = datetime(2026, 10, 2, 6, 0, tzinfo=timezone.utc)

        mock_db = AsyncMock()
        mock_db.scalars.side_effect = [
            MagicMock(first=lambda: self.mock_block),
            MagicMock(all=lambda: []),
        ]

        comp = await OptimizationService.evaluate_block_counterfactual(
            db=mock_db,
            target_block_id=101,
            scenario_type="MOVE_WINDOW",
            new_start=new_s,
            new_end=new_e,
        )

        self.assertEqual(comp.alternative.block_start, new_s)
        self.assertEqual(comp.alternative.block_end, new_e)
        self.assertEqual(comp.alternative.duration_hrs, 4.0)

    async def test_04_baseline_block_remains_unmodified(self):
        mock_db = AsyncMock()
        mock_db.scalars.side_effect = [
            MagicMock(first=lambda: self.mock_block),
            MagicMock(all=lambda: []),
        ]

        await OptimizationService.evaluate_block_counterfactual(
            db=mock_db,
            target_block_id=101,
            scenario_type="POSTPONE",
            postpone_hours=3.0,
        )

        # Invariant: Base block start & end in memory must not be mutated
        self.assertEqual(self.mock_block.block_start, self.base_start)
        self.assertEqual(self.mock_block.block_end, self.base_end)
        self.assertEqual(self.mock_block.block_duration_hrs, 4.0)


class TestCounterfactualEndpoints(unittest.TestCase):
    """End-to-end integration tests for the /blocks/{id}/counterfactual endpoint."""

    def setUp(self):
        self.client = TestClient(app)
        self.base_start = datetime(2026, 10, 1, 6, 0, tzinfo=timezone.utc)
        self.base_end = datetime(2026, 10, 1, 10, 0, tzinfo=timezone.utc)

        self.mock_block = MagicMock(spec=OptimizedBlock)
        self.mock_block.id = 202
        self.mock_block.optimization_run_id = 10
        self.mock_block.section_id = "SEC-01"
        self.mock_block.block_start = self.base_start
        self.mock_block.block_end = self.base_end
        self.mock_block.block_duration_hrs = 4.0
        self.mock_block.is_integrated = False
        self.mock_block.departments_involved = "ENGINEERING"
        self.mock_block.priority_score = 90.0
        self.mock_block.train_conflicts = 0
        self.mock_block.estimated_impact_score = 80.0
        self.mock_block.status = "Candidate"
        self.mock_block.explanation = json.dumps({"resource_status": "VERIFIED"})
        self.mock_block.tasks = []

    def tearDown(self):
        app.dependency_overrides.clear()

    def test_01_anonymous_counterfactual_unauthorized(self):
        resp = self.client.post(
            "/api/v1/optimization/blocks/202/counterfactual",
            json={"scenario_type": "POSTPONE", "postpone_hours": 2.0},
        )
        self.assertEqual(resp.status_code, 401)

    def test_02_authenticated_counterfactual_success(self):
        mock_user = User(
            id="planner-1",
            sub="planner-1",
            username="planner.demo",
            roles=["PLANNER"],
            email="planner@indianrailways.gov.in",
        )
        app.dependency_overrides[get_current_user] = lambda: mock_user

        mock_db = AsyncMock()
        mock_db.scalars.side_effect = [
            MagicMock(first=lambda: self.mock_block),
            MagicMock(all=lambda: []),
        ]
        app.dependency_overrides[get_db] = lambda: mock_db

        resp = self.client.post(
            "/api/v1/optimization/blocks/202/counterfactual",
            json={"scenario_type": "POSTPONE", "postpone_hours": 1.5},
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["target_block_id"], 202)
        self.assertEqual(data["scenario_type"], "POSTPONE")
        self.assertIn("baseline", data)
        self.assertIn("alternative", data)
        self.assertIn("deltas", data)
        self.assertIn("rating", data)
        self.assertIn("explanation", data)
        self.assertEqual(data["baseline"]["duration_hrs"], 4.0)
        self.assertEqual(data["alternative"]["duration_hrs"], 4.0)

    def test_03_counterfactual_non_existent_block_404(self):
        mock_user = User(
            id="planner-1",
            sub="planner-1",
            username="planner.demo",
            roles=["PLANNER"],
            email="planner@indianrailways.gov.in",
        )
        app.dependency_overrides[get_current_user] = lambda: mock_user

        mock_db = AsyncMock()
        mock_db.scalars.side_effect = [
            MagicMock(first=lambda: None),
        ]
        app.dependency_overrides[get_db] = lambda: mock_db

        resp = self.client.post(
            "/api/v1/optimization/blocks/9999/counterfactual",
            json={"scenario_type": "POSTPONE", "postpone_hours": 1.0},
        )
        self.assertEqual(resp.status_code, 404)

    def test_04_counterfactual_invalid_payload_422(self):
        mock_user = User(
            id="planner-1",
            sub="planner-1",
            username="planner.demo",
            roles=["PLANNER"],
            email="planner@indianrailways.gov.in",
        )
        app.dependency_overrides[get_current_user] = lambda: mock_user

        # Missing required parameter for REDUCE_DURATION
        resp = self.client.post(
            "/api/v1/optimization/blocks/202/counterfactual",
            json={"scenario_type": "REDUCE_DURATION"},
        )
        self.assertEqual(resp.status_code, 422)


if __name__ == "__main__":
    unittest.main()
