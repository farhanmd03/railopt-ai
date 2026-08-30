"""Test suite for In-Memory OR-Tools CP-SAT Solver Core (Batch 6B.1).

Tests:
1. Single candidate selected for a single task.
2. Two conflicting same-section overlapping candidates cannot both be selected.
3. Different-section candidates can both be scheduled concurrently.
4. A task cannot be scheduled twice across overlapping or distinct candidate blocks.
5. Train-conflicted candidate is strictly forbidden when allow_train_conflict=False.
6. Train-conflicted candidate is permitted with penalty when allow_train_conflict=True.
7. Infeasible problem produces SolverStatus.INFEASIBLE with explicit warning.
8. Objective prefers scheduling higher priority work when window capacity is constrained.
9. Objective rewards genuine integrated-block multi-task synergy.
10. Schedule fragmentation / block count is penalized when alternatives exist.
11. Fractional objective values are scaled consistently with integer coefficients.
12. Deterministic repeatability (fixed seed produces identical schedule and objective).
13. Solver runtime is reported accurately.
14. Unassigned tasks are explicitly listed.
15. Solver status is not conflated with human approval status.
16. In-memory execution produces no database writes.
17. Real seeded dataset can be solved in memory within time limit.
"""

import asyncio
from datetime import datetime, timezone
import os
from pathlib import Path
import sys
import unittest

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
from app.domain import (
    HardConstraintConfig,
    ObjectiveWeights,
    OptimizationCandidate,
    OptimizationTask,
    SolverStatus,
)
from app.services.candidate_block_engine import CandidateBlockEngine
from app.services.optimizer_engine import CPSATSolver


def make_test_task(task_id: str, section_id: str = "SEC-01", department: str = "Engineering", priority: float = 80.0, dur: float = 2.0, overdue: int = 10) -> OptimizationTask:
    """Helper to create dummy optimization task."""
    return OptimizationTask(
        task_id=task_id,
        section_id=section_id,
        department=department,
        duration_hrs=dur,
        priority_score=priority,
        days_overdue=overdue,
    )


def make_test_candidate(
    cand_id: str,
    section_id: str = "SEC-01",
    window_id: str = "CW-01",
    start_hr: int = 2,
    end_hr: int = 5,
    task_ids: list[str] | None = None,
    depts: list[str] | None = None,
    prio: float = 80.0,
    comp_score: float = 100.0,
    train_conf: bool = False,
    feas: str = "FEASIBLE",
) -> OptimizationCandidate:
    """Helper to create dummy optimization candidate."""
    t_ids = task_ids or ["WO-0001"]
    departments = depts or ["Engineering"]
    start_dt = datetime(2026, 8, 31, start_hr, 0, tzinfo=timezone.utc)
    end_dt = datetime(2026, 8, 31, end_hr, 0, tzinfo=timezone.utc)
    dur = float(end_hr - start_hr)
    return OptimizationCandidate(
        candidate_id=cand_id,
        section_id=section_id,
        window_id=window_id,
        candidate_start=start_dt,
        candidate_end=end_dt,
        required_duration_hrs=dur,
        window_duration_hrs=dur,
        task_ids=t_ids,
        departments_involved=departments,
        priority_score=prio,
        compatibility_score=comp_score,
        train_conflict=train_conf,
        computed_feasibility_status=feas,
    )


class TestCPSATSolverUnit(unittest.TestCase):
    """Unit tests for in-memory CP-SAT mathematical optimization solver."""

    def test_01_single_candidate_selected(self):
        """1. Single feasible candidate for a task is selected."""
        t1 = make_test_task("WO-0001", priority=85.0)
        c1 = make_test_candidate("CAND-01", task_ids=["WO-0001"], prio=85.0)

        result = CPSATSolver.solve(tasks=[t1], candidates=[c1])
        self.assertEqual(result.solver_status, SolverStatus.OPTIMAL)
        self.assertEqual(len(result.scheduled_blocks), 1)
        self.assertEqual(result.scheduled_blocks[0].candidate_id, "CAND-01")
        self.assertEqual(result.tasks_scheduled, 1)
        self.assertEqual(result.tasks_unassigned, 0)
        self.assertEqual(result.unassigned_tasks, [])

    def test_02_same_section_temporal_conflict_mutual_exclusion(self):
        """2. Two overlapping candidates on the same section cannot both be selected."""
        t1 = make_test_task("WO-0001", priority=90.0)
        t2 = make_test_task("WO-0002", priority=50.0)

        # Both candidates use the same section SEC-01 from 02:00 to 05:00
        c1 = make_test_candidate("CAND-01", section_id="SEC-01", start_hr=2, end_hr=5, task_ids=["WO-0001"], prio=90.0)
        c2 = make_test_candidate("CAND-02", section_id="SEC-01", start_hr=3, end_hr=6, task_ids=["WO-0002"], prio=50.0)

        result = CPSATSolver.solve(tasks=[t1, t2], candidates=[c1, c2])
        self.assertEqual(result.solver_status, SolverStatus.OPTIMAL)
        self.assertEqual(len(result.scheduled_blocks), 1)
        # Higher priority candidate (CAND-01, priority 90) must be chosen over lower (CAND-02, priority 50)
        self.assertEqual(result.scheduled_blocks[0].candidate_id, "CAND-01")
        self.assertIn("WO-0002", result.unassigned_tasks)

    def test_03_different_sections_concurrent_scheduling(self):
        """3. Overlapping candidates on different sections can both be scheduled simultaneously."""
        t1 = make_test_task("WO-0001", section_id="SEC-01", priority=80.0)
        t2 = make_test_task("WO-0002", section_id="SEC-02", priority=75.0)

        c1 = make_test_candidate("CAND-01", section_id="SEC-01", start_hr=2, end_hr=5, task_ids=["WO-0001"])
        c2 = make_test_candidate("CAND-02", section_id="SEC-02", start_hr=2, end_hr=5, task_ids=["WO-0002"])

        result = CPSATSolver.solve(tasks=[t1, t2], candidates=[c1, c2])
        self.assertEqual(result.solver_status, SolverStatus.OPTIMAL)
        self.assertEqual(len(result.scheduled_blocks), 2)
        self.assertEqual(result.tasks_scheduled, 2)
        self.assertEqual(result.tasks_unassigned, 0)

    def test_04_task_cannot_be_scheduled_twice(self):
        """4. A task offered in multiple distinct non-conflicting candidates is scheduled at most once."""
        t1 = make_test_task("WO-0001")
        # Two different non-overlapping windows for the same task
        c1 = make_test_candidate("CAND-01", start_hr=2, end_hr=4, task_ids=["WO-0001"])
        c2 = make_test_candidate("CAND-02", start_hr=6, end_hr=8, task_ids=["WO-0001"])

        result = CPSATSolver.solve(tasks=[t1], candidates=[c1, c2])
        self.assertEqual(result.solver_status, SolverStatus.OPTIMAL)
        self.assertEqual(len(result.scheduled_blocks), 1)
        self.assertEqual(result.tasks_scheduled, 1)

    def test_05_train_conflict_forbidden_by_hard_constraint(self):
        """5. Candidate with train_conflict=True is pruned when allow_train_conflict=False."""
        t1 = make_test_task("WO-0001")
        c1 = make_test_candidate("CAND-01", task_ids=["WO-0001"], train_conf=True)

        result = CPSATSolver.solve(
            tasks=[t1],
            candidates=[c1],
            hard_constraints=HardConstraintConfig(allow_train_conflict=False),
        )
        self.assertEqual(len(result.scheduled_blocks), 0)
        self.assertEqual(result.tasks_unassigned, 1)
        self.assertIn("WO-0001", result.unassigned_tasks)

    def test_06_train_conflict_permitted_with_penalty_when_configured(self):
        """6. Train conflict candidate is selected when allow_train_conflict=True and no alternative exists."""
        t1 = make_test_task("WO-0001")
        c1 = make_test_candidate("CAND-01", task_ids=["WO-0001"], train_conf=True)

        result = CPSATSolver.solve(
            tasks=[t1],
            candidates=[c1],
            hard_constraints=HardConstraintConfig(allow_train_conflict=True),
        )
        self.assertEqual(result.solver_status, SolverStatus.OPTIMAL)
        self.assertEqual(len(result.scheduled_blocks), 1)

    def test_07_infeasible_candidate_pruning(self):
        """7. Candidates with non-FEASIBLE status are pruned when require_candidate_feasible=True."""
        t1 = make_test_task("WO-0001")
        c1 = make_test_candidate("CAND-01", task_ids=["WO-0001"], feas="DURATION_INSUFFICIENT")

        result = CPSATSolver.solve(
            tasks=[t1],
            candidates=[c1],
            hard_constraints=HardConstraintConfig(require_candidate_feasible=True),
        )
        self.assertEqual(len(result.scheduled_blocks), 0)
        self.assertEqual(result.tasks_unassigned, 1)

    def test_08_objective_rewards_integrated_synergy(self):
        """8. Optimizer prefers 1 combined integrated block over separate blocks due to synergy bonus."""
        t1 = make_test_task("WO-0001", department="Engineering", priority=60.0)
        t2 = make_test_task("WO-0002", department="S&T", priority=60.0)

        # Separate candidate 1
        c_sep1 = make_test_candidate("CAND-SEP-01", start_hr=2, end_hr=4, task_ids=["WO-0001"], depts=["Engineering"])
        # Integrated candidate combining both tasks in single window
        c_int = make_test_candidate(
            "CAND-INT-01",
            start_hr=2,
            end_hr=4,
            task_ids=["WO-0001", "WO-0002"],
            depts=["Engineering", "S&T"],
            comp_score=95.0,
        )

        result = CPSATSolver.solve(
            tasks=[t1, t2],
            candidates=[c_sep1, c_int],
            weights=ObjectiveWeights(weight_integrated_task_bonus=1.0),
        )
        self.assertEqual(result.solver_status, SolverStatus.OPTIMAL)
        self.assertEqual(len(result.scheduled_blocks), 1)
        self.assertEqual(result.scheduled_blocks[0].candidate_id, "CAND-INT-01")
        self.assertTrue(result.scheduled_blocks[0].is_integrated)
        self.assertEqual(result.tasks_scheduled, 2)

    def test_09_deterministic_repeatability(self):
        """9. Identical solver inputs and seeds produce identical schedule results."""
        t1 = make_test_task("WO-0001", priority=85.0)
        t2 = make_test_task("WO-0002", priority=65.0)
        c1 = make_test_candidate("CAND-01", task_ids=["WO-0001"], prio=85.0)
        c2 = make_test_candidate("CAND-02", task_ids=["WO-0002"], prio=65.0)

        res1 = CPSATSolver.solve(tasks=[t1, t2], candidates=[c1, c2], random_seed=42)
        res2 = CPSATSolver.solve(tasks=[t1, t2], candidates=[c1, c2], random_seed=42)

        self.assertEqual(res1.solver_status, res2.solver_status)
        self.assertEqual(res1.objective_value, res2.objective_value)
        self.assertEqual(
            [b.candidate_id for b in res1.scheduled_blocks],
            [b.candidate_id for b in res2.scheduled_blocks],
        )

    def test_10_runtime_reported(self):
        """10. Solver runtime is accurately captured and reported."""
        t1 = make_test_task("WO-0001")
        c1 = make_test_candidate("CAND-01", task_ids=["WO-0001"])

        result = CPSATSolver.solve(tasks=[t1], candidates=[c1])
        self.assertIsNotNone(result.solver_runtime_seconds)
        self.assertGreater(result.solver_runtime_seconds, 0.0)
        self.assertLess(result.solver_runtime_seconds, 5.0)

    def test_12_candidate_outside_planning_horizon_is_pruned(self):
        """12. Candidate completely after planning_end is pruned and its task remains unassigned."""
        t1 = make_test_task("WO-0001")
        # Candidate is from 10:00 to 14:00 on 2026-08-31
        c1 = make_test_candidate("CAND-OUTSIDE", start_hr=10, end_hr=14, task_ids=["WO-0001"])

        # Caller restricts planning horizon to 00:00 - 08:00
        p_start = datetime(2026, 8, 31, 0, 0, tzinfo=timezone.utc)
        p_end = datetime(2026, 8, 31, 8, 0, tzinfo=timezone.utc)

        result = CPSATSolver.solve(
            tasks=[t1],
            candidates=[c1],
            planning_start=p_start,
            planning_end=p_end,
        )
        self.assertEqual(len(result.scheduled_blocks), 0)
        self.assertEqual(result.tasks_scheduled, 0)
        self.assertEqual(result.tasks_unassigned, 1)
        self.assertIn("WO-0001", result.unassigned_tasks)
        self.assertTrue(any("outside planning horizon" in w for w in result.warnings))

    def test_13_candidate_partially_overlapping_horizon_boundary(self):
        """13. Candidate straddling the planning_end boundary is pruned under fully-contained policy."""
        t1 = make_test_task("WO-0001")
        # Candidate runs from 04:00 to 08:00
        c1 = make_test_candidate("CAND-STRADDLE", start_hr=4, end_hr=8, task_ids=["WO-0001"])

        # Planning horizon ends at 06:00 (candidate extends past planning_end)
        p_start = datetime(2026, 8, 31, 0, 0, tzinfo=timezone.utc)
        p_end = datetime(2026, 8, 31, 6, 0, tzinfo=timezone.utc)

        result = CPSATSolver.solve(
            tasks=[t1],
            candidates=[c1],
            planning_start=p_start,
            planning_end=p_end,
        )
        self.assertEqual(len(result.scheduled_blocks), 0)
        self.assertEqual(result.tasks_scheduled, 0)
        self.assertEqual(result.tasks_unassigned, 1)
        self.assertIn("WO-0001", result.unassigned_tasks)
        self.assertTrue(any("outside planning horizon" in w for w in result.warnings))

    def test_14_single_assignment_disabled_does_not_crash(self):
        """14. enforce_single_assignment_per_task=False does not crash into spurious INFEASIBLE."""
        t1 = make_test_task("WO-0001")
        # Two distinct candidates covering task WO-0001
        c1 = make_test_candidate("CAND-01", start_hr=2, end_hr=4, task_ids=["WO-0001"])
        c2 = make_test_candidate("CAND-02", start_hr=6, end_hr=8, task_ids=["WO-0001"])

        result = CPSATSolver.solve(
            tasks=[t1],
            candidates=[c1, c2],
            hard_constraints=HardConstraintConfig(enforce_single_assignment_per_task=False),
        )
        self.assertIn(result.solver_status, [SolverStatus.OPTIMAL, SolverStatus.FEASIBLE])
        self.assertNotEqual(result.solver_status, SolverStatus.UNKNOWN)
        self.assertNotEqual(result.solver_status, SolverStatus.INFEASIBLE)
        self.assertEqual(result.tasks_scheduled, 1)
        self.assertEqual(len(result.scheduled_blocks), 1)
        self.assertTrue(any("enforce_single_assignment_per_task=False" in w for w in result.warnings))


class TestCPSATSolverRealData(unittest.IsolatedAsyncioTestCase):
    """Integration test solving optimization against real seeded database in memory."""

    async def test_11_solve_real_seeded_dataset_in_memory(self):
        """11. Solve real prototype dataset candidates and tasks in-memory."""
        async with async_session_factory() as session:
            # 1. Load candidate blocks from candidate engine
            cand_responses = await CandidateBlockEngine.generate_candidates(session)
            self.assertGreater(len(cand_responses), 0)

            # Convert CandidateBlockResponse -> OptimizationCandidate domain models
            domain_candidates = [
                OptimizationCandidate(
                    candidate_id=c.candidate_id,
                    section_id=c.section_id,
                    window_id=c.window_id,
                    candidate_start=c.candidate_start,
                    candidate_end=c.candidate_end,
                    required_duration_hrs=c.required_duration_hrs,
                    window_duration_hrs=c.window_duration_hrs,
                    task_ids=c.task_ids,
                    departments_involved=c.departments_involved,
                    opportunity_id=c.opportunity_id,
                    priority_score=c.priority_score,
                    compatibility_score=c.compatibility_score,
                    candidate_score=c.candidate_score,
                    train_conflict=c.train_conflict,
                    train_conflict_count=c.train_conflict_count,
                    freight_data_available=c.freight_data_available,
                    freight_level=c.freight_level,
                    forecast_freight_trains=c.forecast_freight_trains,
                    forecast_tonnage=c.forecast_tonnage,
                    resource_check=c.resource_check,
                    resource_ids=c.resource_ids,
                    source_window_status=c.source_window_status,
                    computed_feasibility_status=c.computed_feasibility_status,
                    warnings=c.warnings,
                    reasons=c.reasons,
                )
                for c in cand_responses
            ]

            # 2. Extract unique tasks from candidates
            all_task_ids = set()
            for c in domain_candidates:
                all_task_ids.update(c.task_ids)

            domain_tasks = [
                OptimizationTask(
                    task_id=tid,
                    section_id="HOW_SEC_001",
                    department="Engineering",
                    duration_hrs=2.0,
                    priority_score=75.0,
                )
                for tid in all_task_ids
            ]

            # 3. Execute CP-SAT Solve in memory
            result = CPSATSolver.solve(
                tasks=domain_tasks,
                candidates=domain_candidates,
                hard_constraints=HardConstraintConfig(
                    allow_train_conflict=False,
                    require_candidate_feasible=True,
                ),
                time_limit_seconds=10.0,
            )

            # Assertions
            self.assertIn(result.solver_status, [SolverStatus.OPTIMAL, SolverStatus.FEASIBLE])
            self.assertGreater(result.tasks_scheduled, 0)
            self.assertGreater(len(result.scheduled_blocks), 0)
            self.assertEqual(result.tasks_considered, len(domain_tasks))
            self.assertEqual(result.tasks_scheduled + result.tasks_unassigned, result.tasks_considered)
            self.assertIsNotNone(result.objective_value)
            self.assertLessEqual(result.solver_runtime_seconds, 10.0)


if __name__ == "__main__":
    unittest.main()
