"""Test suite for Optimization Service and Database Persistence (Batch 6B.2).

Tests:
1. Domain input preparation converts authentic DB records to typed domain models.
2. Successful optimization run is atomically persisted into optimization_runs.
3. Scheduled blocks are persisted in optimized_blocks with correct attributes.
4. Task-to-block junctions are persisted in optimized_block_tasks.
5. No duplicate tasks are linked to the same optimized block.
6. Multiple optimization runs generate distinct run records without overwriting.
7. Source database tables remain completely unchanged (zero row count changes).
8. Transaction rollback works cleanly if persistence is aborted.
9. Infeasible run persists run record with INFEASIBLE status and zero blocks.
10. Solver status is kept distinct from operational approval status (status='Candidate').
11. Full end-to-end solve and persistence on real prototype dataset.
"""

import asyncio
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import sys
import unittest

from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

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
from app.models.asset import Asset, MaintenanceTask
from app.models.corridor import CorridorWindow, FreightForecast
from app.models.geography import Section, Station
from app.models.operations import TrainRun, TrainSectionOccupancy
from app.models.optimization import (
    OptimizationRun,
    OptimizedBlock,
    OptimizedBlockTask,
)
from app.models.resource import Resource
from app.services.optimization_service import OptimizationService
from app.services.priority_engine import compute_priority


class TestOptimizationService(unittest.IsolatedAsyncioTestCase):
    """Integration and persistence test suite for OptimizationService."""

    async def test_01_prepare_domain_inputs(self):
        """1. Domain inputs are properly extracted and typed from authentic database records."""
        async with async_session_factory() as session:
            tasks, candidates = await OptimizationService.prepare_domain_inputs(session)
            self.assertGreater(len(tasks), 0)
            self.assertGreater(len(candidates), 0)

            # Check domain typing
            first_task = tasks[0]
            self.assertIsInstance(first_task, OptimizationTask)
            self.assertIsNotNone(first_task.task_id)
            self.assertIsNotNone(first_task.priority_score)
            self.assertIn(first_task.department, ["Engineering", "S&T", "TRD"])

            first_cand = candidates[0]
            self.assertIsInstance(first_cand, OptimizationCandidate)
            self.assertIsNotNone(first_cand.candidate_id)
            self.assertIsNotNone(first_cand.section_id)

    async def test_02_run_and_persist_optimization_success(self):
        """2. Full optimization run is solved and persisted atomically."""
        async with async_session_factory() as session:
            # Count initial runs
            initial_runs = (await session.scalar(select(func.count(OptimizationRun.id)))) or 0
            initial_blocks = (await session.scalar(select(func.count(OptimizedBlock.id)))) or 0
            initial_links = (await session.scalar(select(func.count(OptimizedBlockTask.id)))) or 0

            run_record, run_result = await OptimizationService.run_and_persist_optimization(
                db=session,
                hard_constraints=HardConstraintConfig(
                    allow_train_conflict=False,
                    require_candidate_feasible=True,
                ),
                time_limit_seconds=10.0,
                run_type="test_suite_run",
            )

            # Verify returned ORM record and domain result
            self.assertIsNotNone(run_record.id)
            self.assertEqual(run_record.solver_status, run_result.solver_status.value)
            self.assertEqual(run_record.run_type, "test_suite_run")
            self.assertEqual(run_record.status, "Completed")
            self.assertIn(run_result.solver_status, [SolverStatus.OPTIMAL, SolverStatus.FEASIBLE])

            # Query database to confirm persistence
            current_runs = (await session.scalar(select(func.count(OptimizationRun.id)))) or 0
            current_blocks = (await session.scalar(select(func.count(OptimizedBlock.id)))) or 0
            current_links = (await session.scalar(select(func.count(OptimizedBlockTask.id)))) or 0

            self.assertEqual(current_runs, initial_runs + 1)
            self.assertEqual(current_blocks, initial_blocks + len(run_result.scheduled_blocks))
            self.assertEqual(current_links, initial_links + run_result.tasks_scheduled)

            # Inspect persisted blocks
            blocks_stmt = (
                select(OptimizedBlock)
                .options(selectinload(OptimizedBlock.tasks))
                .where(OptimizedBlock.optimization_run_id == run_record.id)
            )
            persisted_blocks = (await session.scalars(blocks_stmt)).all()
            self.assertEqual(len(persisted_blocks), len(run_result.scheduled_blocks))

            for pb in persisted_blocks:
                self.assertEqual(pb.status, "Candidate")  # Approval state separation
                self.assertIsNotNone(pb.section_id)
                self.assertGreater(len(pb.tasks), 0)
                # Verify unique task IDs linked to block
                task_ids_in_block = [t.task_id for t in pb.tasks]
                self.assertEqual(len(task_ids_in_block), len(set(task_ids_in_block)))

    async def test_03_multiple_runs_create_distinct_records(self):
        """3. Multiple optimizer runs produce independent historical runs."""
        async with async_session_factory() as session:
            run1, res1 = await OptimizationService.run_and_persist_optimization(
                db=session,
                run_type="run_1",
            )
            run2, res2 = await OptimizationService.run_and_persist_optimization(
                db=session,
                run_type="run_2",
            )

            self.assertNotEqual(run1.id, run2.id)
            self.assertNotEqual(res1.run_id, res2.run_id)

    async def test_04_source_tables_remain_untouched(self):
        """4. Source master tables are never modified during optimization."""
        async with async_session_factory() as session:
            # Snapshot row counts
            cnt_tasks_before = await session.scalar(select(func.count(MaintenanceTask.task_id)))
            cnt_assets_before = await session.scalar(select(func.count(Asset.asset_id)))
            cnt_sections_before = await session.scalar(select(func.count(Section.section_id)))
            cnt_stations_before = await session.scalar(select(func.count(Station.station_code)))
            cnt_windows_before = await session.scalar(select(func.count(CorridorWindow.window_id)))
            cnt_occupancy_before = await session.scalar(select(func.count(TrainSectionOccupancy.occupancy_id)))
            cnt_freight_before = await session.scalar(select(func.count(FreightForecast.id)))
            cnt_resources_before = await session.scalar(select(func.count(Resource.resource_id)))

            # Run optimization
            await OptimizationService.run_and_persist_optimization(db=session)

            # Compare row counts after
            self.assertEqual(cnt_tasks_before, await session.scalar(select(func.count(MaintenanceTask.task_id))))
            self.assertEqual(cnt_assets_before, await session.scalar(select(func.count(Asset.asset_id))))
            self.assertEqual(cnt_sections_before, await session.scalar(select(func.count(Section.section_id))))
            self.assertEqual(cnt_stations_before, await session.scalar(select(func.count(Station.station_code))))
            self.assertEqual(cnt_windows_before, await session.scalar(select(func.count(CorridorWindow.window_id))))
            self.assertEqual(cnt_occupancy_before, await session.scalar(select(func.count(TrainSectionOccupancy.occupancy_id))))
            self.assertEqual(cnt_freight_before, await session.scalar(select(func.count(FreightForecast.id))))
            self.assertEqual(cnt_resources_before, await session.scalar(select(func.count(Resource.resource_id))))

    async def test_05_infeasible_run_persisted_cleanly(self):
        """5. Infeasible run produces an OptimizationRun record with zero blocks and no fake data."""
        async with async_session_factory() as session:
            # Pass impossible planning horizon where all candidates are pruned
            past_start = datetime(2020, 1, 1, 0, 0, tzinfo=timezone.utc)
            past_end = datetime(2020, 1, 2, 0, 0, tzinfo=timezone.utc)

            run_record, run_result = await OptimizationService.run_and_persist_optimization(
                db=session,
                planning_start=past_start,
                planning_end=past_end,
                run_type="infeasible_test",
            )

            self.assertEqual(len(run_result.scheduled_blocks), 0)
            self.assertEqual(run_record.run_type, "infeasible_test")

            # Verify no blocks were inserted for this run in DB
            blocks_cnt = await session.scalar(
                select(func.count(OptimizedBlock.id)).where(OptimizedBlock.optimization_run_id == run_record.id)
            )
            self.assertEqual(blocks_cnt, 0)

    async def test_06_atomic_transaction_rollback_on_failure(self):
        """6. Transaction rolls back completely if persistence fails midway."""
        async with async_session_factory() as session:
            initial_runs = (await session.scalar(select(func.count(OptimizationRun.id)))) or 0
            initial_blocks = (await session.scalar(select(func.count(OptimizedBlock.id)))) or 0

            # Mock a failure by passing an invalid session or monkeypatching
            from unittest.mock import patch

            with patch.object(session, "commit", side_effect=RuntimeError("Simulated DB Disk Failure")):
                with self.assertRaises(RuntimeError):
                    await OptimizationService.run_and_persist_optimization(db=session)

            # Confirm no partial writes persisted
            current_runs = (await session.scalar(select(func.count(OptimizationRun.id)))) or 0
            current_blocks = (await session.scalar(select(func.count(OptimizedBlock.id)))) or 0

            self.assertEqual(current_runs, initial_runs)
            self.assertEqual(current_blocks, initial_blocks)

    async def test_07_persisted_priority_score_matches_summed_task_priority(self):
        """7. Persisted OptimizedBlock.priority_score exactly matches the sum of authentic per-task compute_priority() values."""
        async with async_session_factory() as session:
            run_record, run_result = await OptimizationService.run_and_persist_optimization(
                db=session,
                run_type="priority_audit_test",
            )

            # Query persisted blocks and their junction tasks
            blocks_stmt = (
                select(OptimizedBlock)
                .options(selectinload(OptimizedBlock.tasks))
                .where(OptimizedBlock.optimization_run_id == run_record.id)
            )
            persisted_blocks = (await session.scalars(blocks_stmt)).all()
            self.assertGreater(len(persisted_blocks), 0)

            # Pre-load all MaintenanceTask and Asset records
            task_stmt = select(MaintenanceTask).options(selectinload(MaintenanceTask.asset))
            all_db_tasks = {t.task_id: t for t in (await session.scalars(task_stmt)).all()}

            for pb in persisted_blocks:
                # Independently recompute the priority score for each task in this block
                expected_sum = 0.0
                for t_link in pb.tasks:
                    t = all_db_tasks[t_link.task_id]
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
                    expected_sum += p_res.computed_priority_score

                expected_sum = round(expected_sum, 2)
                # Assert persisted priority_score matches independently recomputed sum
                self.assertAlmostEqual(
                    pb.priority_score,
                    expected_sum,
                    places=2,
                    msg=f"Block {pb.id} persisted priority {pb.priority_score} != expected summed task priority {expected_sum}",
                )


if __name__ == "__main__":
    unittest.main()
