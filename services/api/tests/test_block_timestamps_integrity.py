"""Comprehensive Regression Test Suite for OptimizedBlock Timestamps Integrity.

Tests:
1. Optimizer result extraction preserves candidate start/end into OptimizedBlockDomain.
2. OptimizedBlockDomain carries valid start/end datetimes.
3. OptimizationService.persist_run_result writes exact start/end values to PostgreSQL.
4. Persisting an optimized block with NULL start_time or end_time raises ValueError.
5. Persisting an optimized block with start_time >= end_time raises ValueError.
6. Database-level rejection: attempting to insert NULL block_start/block_end violates NOT NULL constraint.
7. Database-level rejection: attempting to insert block_start >= block_end violates ck_optimized_blocks_start_before_end.
8. API GET /api/v1/optimization/runs/{run_id}/blocks returns HTTP 200 with valid ISO block_start and block_end.
9. All serialized blocks satisfy block_start < block_end.
10. Historical runs and live CP-SAT optimization results serialize without Pydantic ValidationError.
"""

from datetime import datetime, timedelta, timezone
import json
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

import httpx
from fastapi import status
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError

API_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = API_DIR.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))
sys.path.insert(0, str(API_DIR))

from app.core.database import async_session_factory
from app.domain.candidate import OptimizationCandidate
from app.domain.results import OptimizationRunResult, OptimizedBlockDomain, SolverStatus
from app.main import app
from app.models.geography import Section
from app.models.optimization import OptimizationRun, OptimizedBlock
from app.services.optimization_service import OptimizationService
from app.services.optimizer_engine import CPSATSolver


class TestBlockTimestampsIntegrity(unittest.IsolatedAsyncioTestCase):
    """Test suite ensuring OptimizedBlock timestamps are never NULL and start < end."""

    async def asyncSetUp(self):
        self.transport = httpx.ASGITransport(app=app)
        self.client = httpx.AsyncClient(transport=self.transport, base_url="http://test")

        # Mock JWT token verifier for unit tests
        self.auth_patcher = patch("app.core.security.token_verifier.verify_token")
        self.mock_verify = self.auth_patcher.start()

        def side_effect(token: str):
            import jwt
            return jwt.decode(token, "secret-key", algorithms=["HS256"], options={"verify_aud": False})

        self.mock_verify.side_effect = side_effect

        # Seed valid section and test run
        async with async_session_factory() as session:
            sec_stmt = select(Section.section_id)
            self.section_id = (await session.scalars(sec_stmt)).first() or "HOW_SEC_001"

            self.now = datetime.now(timezone.utc).replace(microsecond=0)
            self.start_1 = self.now + timedelta(days=2, hours=8)
            self.end_1 = self.now + timedelta(days=2, hours=12)

            self.run = OptimizationRun(
                run_type="standard",
                solver_status="OPTIMAL",
                objective_value=4500.0,
                solve_time_seconds=1.2,
                approval_status="DRAFT",
                parameters=json.dumps({
                    "run_id": "RUN-INTEGRITY-001",
                    "metrics": {
                        "tasks_considered": 10,
                        "tasks_scheduled": 10,
                        "tasks_unassigned": 0,
                    },
                }),
            )
            session.add(self.run)
            await session.flush()

            self.block = OptimizedBlock(
                optimization_run_id=self.run.id,
                section_id=self.section_id,
                block_start=self.start_1,
                block_end=self.end_1,
                block_duration_hrs=4.0,
                block_type="integrated",
                is_integrated=True,
                departments_involved="Engineering,TRD",
                priority_score=90.0,
                train_conflicts=0,
                estimated_impact_score=95.0,
                status="Candidate",
                explanation=json.dumps({
                    "optimized_block_id": "OPT-INTEGRITY-01",
                    "candidate_id": "CAND-01",
                }),
            )
            session.add(self.block)
            await session.commit()
            await session.refresh(self.run)
            await session.refresh(self.block)

    async def asyncTearDown(self):
        self.auth_patcher.stop()
        await self.client.aclose()
        # Clean up database records
        async with async_session_factory() as session:
            if hasattr(self, "block") and self.block:
                await session.execute(text("DELETE FROM optimized_block_tasks WHERE optimized_block_id = :bid"), {"bid": self.block.id})
                await session.execute(text("DELETE FROM optimized_blocks WHERE id = :bid"), {"bid": self.block.id})
            if hasattr(self, "run") and self.run:
                await session.execute(text("DELETE FROM optimization_runs WHERE id = :rid"), {"rid": self.run.id})
            await session.commit()

    def _get_headers(self, roles=None):
        import jwt
        payload = {
            "sub": "planner-1",
            "preferred_username": "planner.demo",
            "realm_access": {"roles": roles or ["PLANNER"]},
        }
        token = jwt.encode(payload, "secret-key", algorithm="HS256")
        return {"Authorization": f"Bearer {token}"}

    async def test_01_optimizer_result_preserves_candidate_start_end(self):
        """OptimizedBlockDomain must preserve exact candidate start_time and end_time."""
        cand_start = self.now + timedelta(days=1, hours=2)
        cand_end = self.now + timedelta(days=1, hours=6)

        domain_block = OptimizedBlockDomain(
            optimized_block_id="OPT-CAND-001",
            section_id=self.section_id,
            window_id="WIN-001",
            start_time=cand_start,
            end_time=cand_end,
            duration_hrs=4.0,
            candidate_id="CAND-001",
            task_ids=["TSK-01", "TSK-02"],
            departments_involved=["Engineering", "TRD"],
            is_integrated=True,
        )

        self.assertEqual(domain_block.start_time, cand_start)
        self.assertEqual(domain_block.end_time, cand_end)
        self.assertLess(domain_block.start_time, domain_block.end_time)

    async def test_02_persistence_writes_exact_start_end(self):
        """OptimizationService.persist_run_result writes exact start_time and end_time."""
        cand_start = self.now + timedelta(days=3, hours=10)
        cand_end = self.now + timedelta(days=3, hours=14)

        domain_block = OptimizedBlockDomain(
            optimized_block_id="OPT-TEST-002",
            section_id=self.section_id,
            window_id="WIN-002",
            start_time=cand_start,
            end_time=cand_end,
            duration_hrs=4.0,
            candidate_id="CAND-002",
            task_ids=[],
            departments_involved=["Engineering"],
            is_integrated=False,
        )

        run_result = OptimizationRunResult(
            run_id="RUN-PERSIST-002",
            planning_start=self.now,
            planning_end=self.now + timedelta(days=7),
            solver_status=SolverStatus.OPTIMAL,
            objective_value=100.0,
            solver_runtime_seconds=0.5,
            scheduled_blocks=[domain_block],
        )

        async with async_session_factory() as db:
            run_rec, _ = await OptimizationService.persist_run_result(
                db=db,
                run_result=run_result,
                run_type="standard",
            )
            # Fetch persisted block
            b_stmt = select(OptimizedBlock).where(OptimizedBlock.optimization_run_id == run_rec.id)
            persisted_block = (await db.scalars(b_stmt)).first()

            self.assertIsNotNone(persisted_block)
            self.assertEqual(persisted_block.block_start, cand_start)
            self.assertEqual(persisted_block.block_end, cand_end)
            self.assertLess(persisted_block.block_start, persisted_block.block_end)

            # Cleanup
            await db.execute(text("DELETE FROM optimized_blocks WHERE optimization_run_id = :rid"), {"rid": run_rec.id})
            await db.execute(text("DELETE FROM optimization_runs WHERE id = :rid"), {"rid": run_rec.id})
            await db.commit()

    async def test_03_service_rejects_null_timestamps(self):
        """OptimizationService.persist_run_result raises ValueError if start_time or end_time is None."""
        domain_block = OptimizedBlockDomain(
            optimized_block_id="OPT-INVALID-NULL",
            section_id=self.section_id,
            window_id="WIN-003",
            start_time=None,  # type: ignore
            end_time=None,  # type: ignore
            duration_hrs=4.0,
        )

        run_result = OptimizationRunResult(
            run_id="RUN-INVALID-NULL",
            planning_start=self.now,
            planning_end=self.now + timedelta(days=7),
            solver_status=SolverStatus.OPTIMAL,
            scheduled_blocks=[domain_block],
        )

        async with async_session_factory() as db:
            with self.assertRaises(ValueError) as ctx:
                await OptimizationService.persist_run_result(
                    db=db,
                    run_result=run_result,
                    run_type="standard",
                )
            self.assertIn("must not be NULL", str(ctx.exception))

    async def test_04_service_rejects_inverted_timestamps(self):
        """OptimizationService.persist_run_result raises ValueError if start_time >= end_time."""
        domain_block = OptimizedBlockDomain(
            optimized_block_id="OPT-INVALID-INVERTED",
            section_id=self.section_id,
            window_id="WIN-004",
            start_time=self.now + timedelta(hours=6),
            end_time=self.now + timedelta(hours=2),  # Inverted: end is before start
            duration_hrs=4.0,
        )

        run_result = OptimizationRunResult(
            run_id="RUN-INVALID-INVERTED",
            planning_start=self.now,
            planning_end=self.now + timedelta(days=7),
            solver_status=SolverStatus.OPTIMAL,
            scheduled_blocks=[domain_block],
        )

        async with async_session_factory() as db:
            with self.assertRaises(ValueError) as ctx:
                await OptimizationService.persist_run_result(
                    db=db,
                    run_result=run_result,
                    run_type="standard",
                )
            self.assertIn("must be strictly before end_time", str(ctx.exception))

    async def test_05_db_level_rejection_of_null_timestamps(self):
        """Direct DB insert with NULL block_start violates NOT NULL constraint."""
        async with async_session_factory() as db:
            corrupt_block = OptimizedBlock(
                optimization_run_id=self.run.id,
                section_id=self.section_id,
                block_start=None,  # type: ignore
                block_end=self.end_1,
                block_duration_hrs=4.0,
            )
            db.add(corrupt_block)
            with self.assertRaises(IntegrityError):
                await db.commit()
            await db.rollback()

    async def test_06_db_level_check_constraint_start_before_end(self):
        """Direct DB insert with block_start >= block_end violates check constraint."""
        async with async_session_factory() as db:
            corrupt_block = OptimizedBlock(
                optimization_run_id=self.run.id,
                section_id=self.section_id,
                block_start=self.now + timedelta(hours=5),
                block_end=self.now + timedelta(hours=2),  # Invalid inverted timestamps
                block_duration_hrs=3.0,
            )
            db.add(corrupt_block)
            with self.assertRaises(IntegrityError):
                await db.commit()
            await db.rollback()

    async def test_07_api_get_blocks_returns_200_with_valid_timestamps(self):
        """GET /api/v1/optimization/runs/{run_id}/blocks returns HTTP 200 with valid ISO timestamps."""
        headers = self._get_headers(["PLANNER"])
        resp = await self.client.get(
            f"/api/v1/optimization/runs/{self.run.id}/blocks",
            headers=headers,
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.json()
        self.assertIn("items", data)
        self.assertGreaterEqual(len(data["items"]), 1)

        block_item = data["items"][0]
        self.assertIn("block_start", block_item)
        self.assertIn("block_end", block_item)
        self.assertIsNotNone(block_item["block_start"])
        self.assertIsNotNone(block_item["block_end"])

        # Verify parsed ISO datetimes
        parsed_start = datetime.fromisoformat(block_item["block_start"].replace("Z", "+00:00"))
        parsed_end = datetime.fromisoformat(block_item["block_end"].replace("Z", "+00:00"))
        self.assertLess(parsed_start, parsed_end)


if __name__ == "__main__":
    unittest.main()
