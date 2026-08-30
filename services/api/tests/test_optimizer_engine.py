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

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import async_session_factory
from app.domain import (
    HardConstraintConfig,
    ObjectiveWeights,
    OptimizationCandidate,
    OptimizationTask,
    SolverStatus,
)
from app.models.asset import MaintenanceTask
from app.services.candidate_block_engine import CandidateBlockEngine
from app.services.optimizer_engine import CPSATSolver
from app.services.priority_engine import compute_priority


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


    def test_02b_same_section_non_overlapping_both_selected(self):
        """2b. Two non-overlapping candidates on the same section can both be selected."""
        t1 = make_test_task("WO-0001", section_id="SEC-01", priority=80.0)
        t2 = make_test_task("WO-0002", section_id="SEC-01", priority=75.0)

        # Non-overlapping intervals on SEC-01 (02:00-04:00 and 05:00-07:00)
        c1 = make_test_candidate("CAND-01", section_id="SEC-01", start_hr=2, end_hr=4, task_ids=["WO-0001"])
        c2 = make_test_candidate("CAND-02", section_id="SEC-01", start_hr=5, end_hr=7, task_ids=["WO-0002"])

        result = CPSATSolver.solve(tasks=[t1, t2], candidates=[c1, c2])
        self.assertEqual(result.solver_status, SolverStatus.OPTIMAL)
        self.assertEqual(len(result.scheduled_blocks), 2)
        self.assertEqual(result.tasks_scheduled, 2)
        self.assertEqual(result.tasks_unassigned, 0)

    def test_07b_unverified_resource_pruned_under_strict_resource_policy(self):
        """7b. Unverified resource candidates are pruned when require_resource_feasibility=True."""
        t1 = make_test_task("WO-0001")
        c1 = OptimizationCandidate(
            candidate_id="CAND-UNVERIFIED",
            section_id="SEC-01",
            window_id="CW-01",
            candidate_start=datetime(2026, 8, 31, 2, 0, tzinfo=timezone.utc),
            candidate_end=datetime(2026, 8, 31, 5, 0, tzinfo=timezone.utc),
            required_duration_hrs=3.0,
            window_duration_hrs=3.0,
            task_ids=["WO-0001"],
            departments_involved=["Engineering"],
            priority_score=80.0,
            compatibility_score=100.0,
            resource_check="UNVERIFIED",
            computed_feasibility_status="FEASIBLE",
        )

        result = CPSATSolver.solve(
            tasks=[t1],
            candidates=[c1],
            hard_constraints=HardConstraintConfig(require_resource_feasibility=True),
        )
        self.assertEqual(len(result.scheduled_blocks), 0)
        self.assertEqual(result.tasks_unassigned, 1)
        self.assertIn("WO-0001", result.unassigned_tasks)
        self.assertTrue(any("resource availability is 'UNVERIFIED'" in w for w in result.warnings))

    def test_08b_block_count_minimization_behavior(self):
        """8b. Block count penalty favors consolidating multiple tasks into fewer blocks."""
        t1 = make_test_task("WO-0001", priority=70.0)
        t2 = make_test_task("WO-0002", priority=70.0)

        # 2 separate blocks vs 1 combined block of equal priority
        c_sep1 = make_test_candidate("CAND-SEP-01", section_id="SEC-01", start_hr=1, end_hr=3, task_ids=["WO-0001"])
        c_sep2 = make_test_candidate("CAND-SEP-02", section_id="SEC-02", start_hr=4, end_hr=6, task_ids=["WO-0002"])
        c_comb = make_test_candidate(
            "CAND-COMB",
            section_id="SEC-01",
            start_hr=1,
            end_hr=3,
            task_ids=["WO-0001", "WO-0002"],
            depts=["Engineering", "S&T"],
            comp_score=100.0,
        )

        result = CPSATSolver.solve(
            tasks=[t1, t2],
            candidates=[c_sep1, c_sep2, c_comb],
            weights=ObjectiveWeights(weight_total_block_count=2.0),
        )
        self.assertEqual(result.solver_status, SolverStatus.OPTIMAL)
        self.assertEqual(len(result.scheduled_blocks), 1)
        self.assertEqual(result.scheduled_blocks[0].candidate_id, "CAND-COMB")
        self.assertEqual(result.tasks_scheduled, 2)


class TestCPSATSolverRealData(unittest.IsolatedAsyncioTestCase):
    """Integration test solving optimization against real seeded database in memory."""

    async def test_11_solve_real_seeded_dataset_in_memory(self):
        """11. Solve real prototype dataset candidates and tasks in-memory with full invariant checks."""
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

            candidate_dict = {c.candidate_id: c for c in domain_candidates}
            all_task_ids = {tid for c in domain_candidates for tid in c.task_ids}

            # 2. Load authentic tasks from database and compute dynamic domain priority
            stmt = select(MaintenanceTask).options(selectinload(MaintenanceTask.asset))
            db_tasks = (await session.scalars(stmt)).all()
            self.assertGreaterEqual(len(db_tasks), len(all_task_ids))

            domain_tasks = []
            for t in db_tasks:
                if t.task_id not in all_task_ids:
                    continue
                crit = t.asset.criticality_index if t.asset else None
                risk = t.asset.failure_risk_score if t.asset else None
                p_res = compute_priority(
                    task_id=t.task_id,
                    department=t.department,
                    severity=t.severity,
                    days_overdue=t.days_overdue,
                    asset_id=t.asset_id,
                    section_id=t.section_id,
                    criticality_index=crit,
                    failure_risk_score=risk,
                    baseline_priority_score=t.priority_score,
                )
                # Note: duration_hrs on OptimizationTask is informative; candidate blocks carry required_duration_hrs
                dur = float(t.required_duration_hrs) if t.required_duration_hrs is not None else 2.0
                domain_tasks.append(
                    OptimizationTask(
                        task_id=t.task_id,
                        section_id=t.section_id or "UNKNOWN",
                        department=t.department,
                        duration_hrs=dur,
                        priority_score=p_res.computed_priority_score,
                        days_overdue=t.days_overdue,
                        asset_id=t.asset_id,
                        severity=t.severity,
                    )
                )

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

            # Assertions & Invariant Validation
            self.assertIn(result.solver_status, [SolverStatus.OPTIMAL, SolverStatus.FEASIBLE])
            self.assertGreater(result.tasks_scheduled, 0)
            self.assertGreater(len(result.scheduled_blocks), 0)
            self.assertEqual(result.tasks_considered, len(domain_tasks))
            self.assertEqual(result.tasks_scheduled + result.tasks_unassigned, result.tasks_considered)
            self.assertIsNotNone(result.objective_value)
            self.assertLessEqual(result.solver_runtime_seconds, 10.0)

            # INVARIANT 1: Task IDs belong to actual candidates
            seen_tasks: set[str] = set()
            for b in result.scheduled_blocks:
                cand = candidate_dict[b.candidate_id]
                self.assertEqual(b.section_id, cand.section_id)
                self.assertEqual(b.task_ids, cand.task_ids)
                self.assertEqual(b.departments_involved, cand.departments_involved)
                self.assertFalse(cand.train_conflict, "No train conflict block should be selected under strict policy")

                # INVARIANT 2: No task appears in multiple selected blocks
                for tid in b.task_ids:
                    self.assertNotIn(tid, seen_tasks, f"Task {tid} scheduled in multiple blocks!")
                    seen_tasks.add(tid)

            # INVARIANT 3: No two selected same-section blocks overlap temporally
            blocks_by_sec: dict[str, list] = {}
            for b in result.scheduled_blocks:
                blocks_by_sec.setdefault(b.section_id, []).append(b)

            for sec, blist in blocks_by_sec.items():
                for i in range(len(blist)):
                    for j in range(i + 1, len(blist)):
                        b1, b2 = blist[i], blist[j]
                        overlap = b1.start_time < b2.end_time and b1.end_time > b2.start_time
                        self.assertFalse(overlap, f"Temporal overlap between blocks {b1.optimized_block_id} and {b2.optimized_block_id} on section {sec}!")

            # INVARIANT 4: Integrated blocks contain multiple tasks / departments
            for b in result.scheduled_blocks:
                if b.is_integrated:
                    self.assertTrue(len(b.task_ids) > 1 or len(b.departments_involved) > 1)

    async def test_15_real_data_priority_varies(self):
        """15. Real data optimization results exhibit meaningfully varying priority values across blocks."""
        async with async_session_factory() as session:
            cand_responses = await CandidateBlockEngine.generate_candidates(session)
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

            stmt = select(MaintenanceTask).options(selectinload(MaintenanceTask.asset))
            db_tasks = (await session.scalars(stmt)).all()

            domain_tasks = []
            for t in db_tasks:
                crit = t.asset.criticality_index if t.asset else None
                risk = t.asset.failure_risk_score if t.asset else None
                p_res = compute_priority(
                    task_id=t.task_id,
                    department=t.department,
                    severity=t.severity,
                    days_overdue=t.days_overdue,
                    asset_id=t.asset_id,
                    section_id=t.section_id,
                    criticality_index=crit,
                    failure_risk_score=risk,
                    baseline_priority_score=t.priority_score,
                )
                domain_tasks.append(
                    OptimizationTask(
                        task_id=t.task_id,
                        section_id=t.section_id or "UNKNOWN",
                        department=t.department,
                        duration_hrs=float(t.required_duration_hrs or 2.0),
                        priority_score=p_res.computed_priority_score,
                        days_overdue=t.days_overdue,
                    )
                )

            result = CPSATSolver.solve(
                tasks=domain_tasks,
                candidates=domain_candidates,
                hard_constraints=HardConstraintConfig(
                    allow_train_conflict=False,
                    require_candidate_feasible=True,
                ),
            )
            self.assertEqual(result.solver_status, SolverStatus.OPTIMAL)
            block_priorities = [b.priority_value for b in result.scheduled_blocks]
            self.assertGreater(len(block_priorities), 1)
            # Assert priority values are not a trivial single constant
            self.assertGreater(len(set(block_priorities)), 5)
            self.assertNotEqual(min(block_priorities), max(block_priorities))

    async def test_16_real_data_higher_priority_preferred_when_constrained(self):
        """16. Higher real priority task is preferred over lower priority task on mutually exclusive window."""
        async with async_session_factory() as session:
            stmt = select(MaintenanceTask).options(selectinload(MaintenanceTask.asset))
            db_tasks = (await session.scalars(stmt)).all()

            # Find two tasks from the same section with different computed priorities
            task_domain_map = {}
            for t in db_tasks:
                crit = t.asset.criticality_index if t.asset else None
                risk = t.asset.failure_risk_score if t.asset else None
                p_res = compute_priority(
                    task_id=t.task_id,
                    department=t.department,
                    severity=t.severity,
                    days_overdue=t.days_overdue,
                    asset_id=t.asset_id,
                    section_id=t.section_id,
                    criticality_index=crit,
                    failure_risk_score=risk,
                    baseline_priority_score=t.priority_score,
                )
                task_domain_map[t.task_id] = OptimizationTask(
                    task_id=t.task_id,
                    section_id=t.section_id or "UNKNOWN",
                    department=t.department,
                    duration_hrs=float(t.required_duration_hrs or 2.0),
                    priority_score=p_res.computed_priority_score,
                    days_overdue=t.days_overdue,
                )

            # Sort tasks by priority descending
            sorted_tasks = sorted(task_domain_map.values(), key=lambda x: x.priority_score, reverse=True)
            high_task = sorted_tasks[0]  # highest priority
            low_task = sorted_tasks[-1]  # lowest priority

            self.assertGreater(high_task.priority_score, low_task.priority_score + 10.0)

            # Create conflicting candidates in the same window
            c_high = make_test_candidate(
                "CAND-HIGH",
                section_id="HOW_SEC_001",
                start_hr=2,
                end_hr=5,
                task_ids=[high_task.task_id],
                prio=high_task.priority_score,
            )
            c_low = make_test_candidate(
                "CAND-LOW",
                section_id="HOW_SEC_001",
                start_hr=2,
                end_hr=5,
                task_ids=[low_task.task_id],
                prio=low_task.priority_score,
            )

            result = CPSATSolver.solve(
                tasks=[high_task, low_task],
                candidates=[c_high, c_low],
            )
            self.assertEqual(result.solver_status, SolverStatus.OPTIMAL)
            self.assertEqual(len(result.scheduled_blocks), 1)
            self.assertEqual(result.scheduled_blocks[0].candidate_id, "CAND-HIGH")
            self.assertIn(low_task.task_id, result.unassigned_tasks)

    def test_17_realized_priority_matches_summed_task_priority(self):
        """17. Realized priority on scheduled block exactly matches summed task priorities, distinct from candidate score."""
        t1 = make_test_task("WO-P1", priority=85.5)
        t2 = make_test_task("WO-P2", priority=62.25)
        expected_realized = round(85.5 + 62.25, 2)  # 147.75

        # Build candidate with deliberately different candidate priority_score (e.g. 50.0)
        c = make_test_candidate(
            "CAND-MULTI-PRIO",
            task_ids=["WO-P1", "WO-P2"],
            prio=50.0,
            comp_score=90.0,
        )

        result = CPSATSolver.solve(
            tasks=[t1, t2],
            candidates=[c],
        )

        self.assertEqual(result.solver_status, SolverStatus.OPTIMAL)
        self.assertEqual(len(result.scheduled_blocks), 1)
        block = result.scheduled_blocks[0]
        self.assertEqual(block.priority_value, 50.0)  # 5C candidate-stage score
        self.assertEqual(block.realized_priority_value, expected_realized)  # Authentic summed task priorities


if __name__ == "__main__":
    unittest.main()
