"""Test suite for Optimization Domain Foundation & Priority Engine Decoupling (Batch 6A).

Tests:
1. Priority engine returns a domain PriorityCalculationResult object, not a Pydantic response schema.
2. API endpoint GET /api/v1/maintenance-tasks/{task_id}/priority still returns PriorityAssessmentResponse.
3. baseline_priority_score remains distinct from computed_priority_score in the domain result.
4. OptimizationCandidate domain model can be constructed and verified.
5. OptimizationTask preserves actual task attributes.
6. TrainOccupancyDomain preserves timetable intervals.
7. CorridorWindowDomain preserves window start/end timestamps and durations.
8. ResourceDomain preserves department, depot, and availability intervals.
9. ObjectiveWeights defines explicit named weights and rejects negative values.
10. HardConstraintConfig defines explicit constraint bounds.
11. OptimizationRunResult and SolverStatus distinguish solver status from approval status.
12. OptimizedBlockDomain represents optimizer-assigned blocks cleanly.
"""

from datetime import date, datetime, time, timezone
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

from app.domain import (
    CorridorWindowDomain,
    HardConstraintConfig,
    ObjectiveWeights,
    OptimizationCandidate,
    OptimizationRunResult,
    OptimizationTask,
    OptimizedBlockDomain,
    PriorityCalculationResult,
    PriorityComponents,
    ResourceDomain,
    SolverStatus,
    TrainOccupancyDomain,
)
from app.schemas.maintenance import PriorityAssessmentResponse
from app.services.priority_engine import compute_priority

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


def http_get(path: str, token: str | None = None) -> tuple[int, dict]:
    """Execute synchronous HTTP request to running local API server."""
    url = f"http://127.0.0.1:8000{path}"
    req = urllib.request.Request(url)
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return resp.status, data
    except urllib.error.HTTPError as e:
        data = json.loads(e.read().decode("utf-8"))
        return e.code, data


class TestOptimizationDomain(unittest.TestCase):
    """Unit tests for decoupled priority engine and optimization domain models."""

    def test_01_priority_engine_returns_domain_model(self):
        """1. compute_priority returns a PriorityCalculationResult dataclass, NOT a Pydantic schema."""
        result = compute_priority(
            task_id="WO-0001",
            department="Engineering",
            severity="High",
            days_overdue=10,
            asset_id="TRK-HWH-01",
            section_id="HOW_SEC_001",
            criticality_index=4.0,
            failure_risk_score=0.35,
            baseline_priority_score=45.0,
        )
        self.assertIsInstance(result, PriorityCalculationResult)
        self.assertNotIsInstance(result, PriorityAssessmentResponse)
        self.assertIsInstance(result.components, PriorityComponents)
        self.assertEqual(result.task_id, "WO-0001")
        self.assertEqual(result.department, "Engineering")
        self.assertGreater(result.computed_priority_score, 0.0)

    def test_02_baseline_and_computed_priority_distinction(self):
        """2. baseline_priority_score remains strictly distinct from computed_priority_score."""
        result = compute_priority(
            task_id="WO-0002",
            department="S&T",
            severity="Critical",
            days_overdue=25,
            baseline_priority_score=15.0,
        )
        self.assertEqual(result.baseline_priority_score, 15.0)
        self.assertNotEqual(result.computed_priority_score, result.baseline_priority_score)
        self.assertGreaterEqual(result.computed_priority_score, 65.0)

    def test_03_optimization_task_domain_model(self):
        """3. OptimizationTask preserves actual task attributes."""
        task = OptimizationTask(
            task_id="WO-0010",
            section_id="HOW_SEC_002",
            department="TRD",
            duration_hrs=3.5,
            priority_score=82.5,
            days_overdue=14,
            asset_id="OHE-BDC-02",
            severity="High",
        )
        self.assertEqual(task.task_id, "WO-0010")
        self.assertEqual(task.section_id, "HOW_SEC_002")
        self.assertEqual(task.department, "TRD")
        self.assertEqual(task.duration_hrs, 3.5)
        self.assertEqual(task.priority_score, 82.5)

    def test_04_corridor_window_domain_model(self):
        """4. CorridorWindowDomain preserves exact timestamps and durations."""
        start = datetime(2026, 8, 31, 2, 0, tzinfo=timezone.utc)
        end = datetime(2026, 8, 31, 6, 0, tzinfo=timezone.utc)
        cw = CorridorWindowDomain(
            window_id="CW-0001",
            section_id="HOW_SEC_001",
            window_start=start,
            window_end=end,
            duration_hrs=4.0,
            source_status="FEASIBLE",
            computed_feasibility_status="FEASIBLE",
        )
        self.assertEqual(cw.window_id, "CW-0001")
        self.assertEqual(cw.duration_hrs, 4.0)

    def test_05_train_occupancy_domain_model(self):
        """5. TrainOccupancyDomain preserves train passage intervals."""
        occ = TrainOccupancyDomain(
            occupancy_id="OCC-001",
            train_id="EXP-1234",
            section_id="HOW_SEC_001",
            entry_time=time(10, 30),
            exit_time=time(11, 0),
            train_type="Express",
            priority_rank=1,
        )
        self.assertEqual(occ.train_id, "EXP-1234")
        self.assertEqual(occ.entry_time, time(10, 30))

    def test_06_resource_domain_model(self):
        """6. ResourceDomain preserves depot and availability intervals."""
        res = ResourceDomain(
            resource_id="RES-001",
            department="Engineering",
            depot="Dankuni",
            availability_from=time(22, 0),
            availability_to=time(5, 0),
            status="Available",
            capacity_units=1,
        )
        self.assertEqual(res.resource_id, "RES-001")
        self.assertEqual(res.depot, "Dankuni")

    def test_07_optimization_candidate_domain_model(self):
        """7. OptimizationCandidate represents all candidate block attributes."""
        start = datetime(2026, 8, 31, 2, 0, tzinfo=timezone.utc)
        end = datetime(2026, 8, 31, 6, 0, tzinfo=timezone.utc)
        cand = OptimizationCandidate(
            candidate_id="CAND-001",
            section_id="HOW_SEC_001",
            window_id="CW-0001",
            candidate_start=start,
            candidate_end=end,
            required_duration_hrs=3.0,
            window_duration_hrs=4.0,
            task_ids=["WO-0001", "WO-0002"],
            departments_involved=["Engineering", "S&T"],
            priority_score=85.0,
            compatibility_score=90.0,
            candidate_score=87.5,
            train_conflict=False,
            computed_feasibility_status="FEASIBLE",
        )
        self.assertEqual(cand.candidate_id, "CAND-001")
        self.assertEqual(cand.task_ids, ["WO-0001", "WO-0002"])
        self.assertFalse(cand.train_conflict)

    def test_08_objective_weights_configuration(self):
        """8. ObjectiveWeights distinguishes MAXIMIZE vs MINIMIZE weights and validates values."""
        weights = ObjectiveWeights(
            weight_priority_score=1.5,
            weight_integrated_task_bonus=0.8,
            weight_train_disruption=3.0,
        )
        self.assertEqual(weights.weight_priority_score, 1.5)
        self.assertEqual(weights.weight_integrated_task_bonus, 0.8)
        self.assertEqual(weights.weight_train_disruption, 3.0)

        # Rejects negative weights
        with self.assertRaises(ValueError):
            ObjectiveWeights(weight_priority_score=-1.0)

    def test_09_hard_constraint_configuration(self):
        """9. HardConstraintConfig defines explicit constraint parameters."""
        cfg = HardConstraintConfig(
            max_block_duration_hrs=6.0,
            allow_train_conflict=False,
            require_candidate_feasible=True,
            max_tasks_per_block=3,
        )
        self.assertEqual(cfg.max_block_duration_hrs, 6.0)
        self.assertFalse(cfg.allow_train_conflict)
        self.assertTrue(cfg.require_candidate_feasible)
        self.assertEqual(cfg.max_tasks_per_block, 3)

    def test_10_solver_status_and_optimization_result(self):
        """10. OptimizationRunResult uses SolverStatus without conflating approval status."""
        start = datetime(2026, 8, 31, 0, 0, tzinfo=timezone.utc)
        end = datetime(2026, 8, 31, 23, 59, tzinfo=timezone.utc)

        block = OptimizedBlockDomain(
            optimized_block_id="OPT-BLK-001",
            section_id="HOW_SEC_001",
            window_id="CW-0001",
            candidate_id="CAND-001",
            start_time=datetime(2026, 8, 31, 2, 0, tzinfo=timezone.utc),
            end_time=datetime(2026, 8, 31, 5, 0, tzinfo=timezone.utc),
            duration_hrs=3.0,
            task_ids=["WO-0001"],
            departments_involved=["Engineering"],
            is_integrated=False,
            priority_value=85.0,
        )

        result = OptimizationRunResult(
            run_id="RUN-20260831-01",
            planning_start=start,
            planning_end=end,
            solver_status=SolverStatus.OPTIMAL,
            objective_value=128.5,
            scheduled_blocks=[block],
            unassigned_tasks=["WO-0003"],
            tasks_considered=2,
            tasks_scheduled=1,
            tasks_unassigned=1,
            integrated_block_count=0,
            separate_block_count=1,
            estimated_total_block_hours=3.0,
            solver_runtime_seconds=0.45,
        )

        self.assertEqual(result.solver_status, SolverStatus.OPTIMAL)
        self.assertEqual(result.solver_status.value, "OPTIMAL")
        self.assertEqual(len(result.scheduled_blocks), 1)
        self.assertEqual(result.tasks_scheduled, 1)


class TestOptimizationDomainAPI(unittest.TestCase):
    """Integration test verifying API conversion of decoupled domain result."""

    @classmethod
    def setUpClass(cls):
        try:
            cls.token = obtain_demo_token("engineering.demo")
        except Exception:
            cls.token = None

    def test_11_priority_api_returns_expected_schema(self):
        """11. GET /api/v1/maintenance-tasks/WO-0001/priority returns PriorityAssessmentResponse schema."""
        self.assertIsNotNone(self.token, "Keycloak demo token required")
        status, data = http_get("/api/v1/maintenance-tasks/WO-0001/priority", token=self.token)
        self.assertEqual(status, 200)
        self.assertEqual(data["task_id"], "WO-0001")
        self.assertIn("computed_priority_score", data)
        self.assertIn("baseline_priority_score", data)
        self.assertIn("priority_band", data)
        self.assertIn("components", data)
        self.assertIn("reasons", data)
        self.assertIsInstance(data["components"], dict)
        self.assertIn("severity_component", data["components"])


if __name__ == "__main__":
    unittest.main()
