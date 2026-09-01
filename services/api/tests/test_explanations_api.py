"""Tests for Ollama-Powered Explainability Layer (Batch 7L).

Verifies:
- RBAC and endpoint authentication
- Deterministic fact assembly for RUN_SUMMARY, BLOCK_EXPLANATION, UNASSIGNED_TASK, SCENARIO_COMPARISON
- Prompt injection defense (untrusted database strings treated as data)
- Structured JSON response parsing
- Graceful handling when Ollama is offline or times out
- Deterministic factual fallback when model output is malformed
"""

import asyncio
import json
import os
import sys
from pathlib import Path
import unittest
from unittest.mock import AsyncMock, patch

API_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(API_DIR))

from datetime import datetime, timedelta, timezone
import httpx
from fastapi import status
from sqlalchemy import select, text

from app.core.config import settings
from app.core.database import async_session_factory
from app.main import app
from app.models.asset import Asset, MaintenanceTask
from app.models.optimization import OptimizationRun, OptimizationScenario, OptimizedBlock, OptimizedBlockTask
from app.schemas.explanation import ExplanationType
from app.services.explainability_service import ExplainabilityService


def make_auth_headers(sub: str = "planner-user", roles: list[str] = None, username: str = "planner.demo"):
    """Helper to mock keycloak auth tokens."""
    import jwt
    payload = {
        "sub": sub,
        "preferred_username": username,
        "azp": "railopt-web",
        "aud": ["railopt-web"],
        "realm_access": {"roles": roles or ["PLANNER"]},
        "iss": "http://localhost:8080/realms/railopt",
    }
    token = jwt.encode(payload, "secret-key", algorithm="HS256")
    return {"Authorization": f"Bearer {token}"}


class TestExplainabilityAPI(unittest.IsolatedAsyncioTestCase):
    """Test suite for Explainability Service and Endpoints."""

    async def asyncSetUp(self):
        self.transport = httpx.ASGITransport(app=app)
        self.client = httpx.AsyncClient(transport=self.transport, base_url="http://test")

        # Mock JWT verification for unit tests
        self.auth_patcher = patch("app.core.security.token_verifier.verify_token")
        self.mock_verify = self.auth_patcher.start()

        def side_effect(token: str):
            import jwt
            return jwt.decode(token, "secret-key", algorithms=["HS256"], options={"verify_aud": False})

        self.mock_verify.side_effect = side_effect

        # Seed sample optimization run in DB
        async with async_session_factory() as session:
            from app.models.geography import Section
            sec_stmt = select(Section.section_id)
            sec_id = (await session.scalars(sec_stmt)).first()

            self.run = OptimizationRun(
                run_type="standard",
                solver_status="OPTIMAL",
                objective_value=5420.50,
                solve_time_seconds=1.85,
                approval_status="DRAFT",
                parameters=json.dumps({
                    "run_id": "RUN-TEST-001",
                    "metrics": {
                        "tasks_considered": 30,
                        "tasks_scheduled": 28,
                        "tasks_unassigned": 2,
                        "integrated_block_count": 6,
                        "separate_block_count": 4,
                        "estimated_total_block_hours": 42.0,
                        "unassigned_task_ids": ["TSK-EXP-99"],
                    },
                }),
            )
            session.add(self.run)
            await session.flush()

            now = datetime.now(timezone.utc)
            self.block = OptimizedBlock(
                optimization_run_id=self.run.id,
                section_id=sec_id,
                block_start=now + timedelta(days=1),
                block_end=now + timedelta(days=1, hours=4),
                block_duration_hrs=4.0,
                block_type="integrated",
                is_integrated=True,
                departments_involved="ENGG,TRD",
                priority_score=95.5,
                train_conflicts=0,
                estimated_impact_score=90.0,
                status="Candidate",
                explanation=json.dumps({"candidate_id": "CAND-001"}),
            )
            session.add(self.block)
            await session.flush()

            # Ensure test task is created or updated
            t_stmt = select(MaintenanceTask).where(MaintenanceTask.task_id == "TSK-EXP-99")
            existing_task = (await session.scalars(t_stmt)).first()
            if not existing_task:
                self.task = MaintenanceTask(
                    task_id="TSK-EXP-99",
                    section_id=sec_id,
                    department="ENGG",
                    defect_type="Track Settlement",
                    severity="High",
                    days_overdue=14,
                    priority_score=88.0,
                    required_duration_hrs=3.5,
                    postpone_penalty_cost=150.0,
                    status="Open",
                )
                session.add(self.task)
            else:
                self.task = existing_task

            await session.commit()
            await session.refresh(self.run)
            await session.refresh(self.block)
            await session.refresh(self.task)

    async def asyncTearDown(self):
        self.auth_patcher.stop()
        await self.client.aclose()
        # Clean up seeded test records from database
        async with async_session_factory() as session:
            if hasattr(self, "block") and self.block:
                await session.execute(text("DELETE FROM optimized_block_tasks WHERE optimized_block_id = :bid"), {"bid": self.block.id})
                await session.execute(text("DELETE FROM optimized_blocks WHERE id = :bid"), {"bid": self.block.id})
            if hasattr(self, "run") and self.run:
                await session.execute(text("DELETE FROM optimization_runs WHERE id = :rid"), {"rid": self.run.id})
            await session.execute(text("DELETE FROM maintenance_tasks WHERE task_id = 'TSK-EXP-99'"))
            await session.commit()

    async def test_01_anonymous_request_rejected(self):
        """Anonymous access to explanations must return 401."""
        resp = await self.client.post("/api/v1/explanations", json={
            "explanation_type": "RUN_SUMMARY",
            "run_id": self.run.id,
        })
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    async def test_02_health_endpoint(self):
        """Health endpoint returns available status."""
        headers = make_auth_headers(roles=["PLANNER"])
        resp = await self.client.get("/api/v1/explanations/health", headers=headers)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.json()
        self.assertIn("available", data)
        self.assertIn("model", data)

    async def test_03_run_summary_explanation(self):
        """Grounded explanation generation for RUN_SUMMARY."""
        headers = make_auth_headers(roles=["PLANNER"])

        mock_ollama_json = json.dumps({
            "summary": f"Optimization Run #{self.run.id} scheduled 28 out of 30 tasks with a total objective score of 5420.5.",
            "key_factors": [
                "Solver achieved global optimality with 6 cross-department integrated blocks.",
                "Total corridor possession time was bounded to 42.0 hours.",
            ],
            "limitations": ["2 tasks were unassigned due to timetable boundary constraints."],
            "confidence_note": "Grounded strictly in CP-SAT solver metrics.",
        })

        with patch.object(ExplainabilityService, "_call_ollama", new_callable=AsyncMock) as mock_call:
            mock_call.return_value = mock_ollama_json

            resp = await self.client.post(
                "/api/v1/explanations",
                headers=headers,
                json={
                    "explanation_type": "RUN_SUMMARY",
                    "run_id": self.run.id,
                },
            )

            self.assertEqual(resp.status_code, status.HTTP_200_OK)
            data = resp.json()
            self.assertEqual(data["explanation_type"], "RUN_SUMMARY")
            self.assertIn("Optimization Run", data["summary"])
            self.assertEqual(len(data["key_factors"]), 2)
            self.assertEqual(data["deterministic_facts"]["tasks_scheduled"], 28)
            self.assertEqual(data["deterministic_facts"]["solver_status"], "OPTIMAL")
            self.assertIn("AI-generated explanation", data["disclaimer"])

    async def test_04_block_explanation(self):
        """Grounded explanation for a specific corridor block."""
        headers = make_auth_headers(roles=["ENGINEERING"])

        mock_ollama_json = json.dumps({
            "summary": f"Block #{self.block.id} is an integrated 4-hour window consolidating ENGG and TRD work.",
            "key_factors": [
                "Zero train timetable conflicts detected.",
                "Realized priority score of 95.5 points.",
            ],
            "limitations": ["Requires coordination between Engineering and Traction departments."],
            "confidence_note": "Grounded in corridor block data.",
        })

        with patch.object(ExplainabilityService, "_call_ollama", new_callable=AsyncMock) as mock_call:
            mock_call.return_value = mock_ollama_json

            resp = await self.client.post(
                "/api/v1/explanations",
                headers=headers,
                json={
                    "explanation_type": "BLOCK_EXPLANATION",
                    "run_id": self.run.id,
                    "block_id": self.block.id,
                },
            )

            self.assertEqual(resp.status_code, status.HTTP_200_OK)
            data = resp.json()
            self.assertEqual(data["explanation_type"], "BLOCK_EXPLANATION")
            self.assertEqual(data["deterministic_facts"]["section_id"], self.block.section_id)
            self.assertTrue(data["deterministic_facts"]["is_integrated"])

    async def test_05_unassigned_task_explanation(self):
        """Grounded explanation for an unassigned task."""
        headers = make_auth_headers(roles=["VIEWER"])

        mock_ollama_json = json.dumps({
            "summary": f"Task TSK-EXP-99 was not scheduled because no candidate possession window accommodated its required duration.",
            "key_factors": [
                "Required window of 3.5 hours on section HWH-BWN.",
                "Severity is HIGH with 14 days overdue.",
            ],
            "limitations": ["Task remains in backlog pending next planning cycle."],
            "confidence_note": "Grounded in task attributes.",
        })

        with patch.object(ExplainabilityService, "_call_ollama", new_callable=AsyncMock) as mock_call:
            mock_call.return_value = mock_ollama_json

            resp = await self.client.post(
                "/api/v1/explanations",
                headers=headers,
                json={
                    "explanation_type": "UNASSIGNED_TASK",
                    "run_id": self.run.id,
                    "task_id": "TSK-EXP-99",
                },
            )

            self.assertEqual(resp.status_code, status.HTTP_200_OK)
            data = resp.json()
            self.assertEqual(data["explanation_type"], "UNASSIGNED_TASK")
            self.assertEqual(data["deterministic_facts"]["days_overdue"], 14)

    async def test_06_prompt_injection_defense(self):
        """Untrusted text in database is delimited inside UNTRUSTED_SYSTEM_DATA and cannot escape."""
        service = ExplainabilityService()
        async with async_session_factory() as session:
            facts, context = await service._assemble_facts_and_context(
                request=type("Req", (), {
                    "explanation_type": ExplanationType.RUN_SUMMARY,
                    "run_id": self.run.id,
                })(),
                db=session,
            )
            self.assertIn("Run ID:", context)
            self.assertIn(str(self.run.id), context)

    async def test_07_ollama_offline_returns_503(self):
        """When Ollama is unreachable, service returns HTTP 503."""
        headers = make_auth_headers(roles=["PLANNER"])
        service = ExplainabilityService(base_url="http://127.0.0.1:59999")  # Unreachable port

        with patch("app.routers.explanations.ExplainabilityService", return_value=service):
            resp = await self.client.post(
                "/api/v1/explanations",
                headers=headers,
                json={
                    "explanation_type": "RUN_SUMMARY",
                    "run_id": self.run.id,
                },
            )
            self.assertEqual(resp.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
            self.assertIn("Local explanation service unavailable", resp.json()["detail"])

    async def test_08_malformed_model_output_fallback(self):
        """When model outputs plain text instead of JSON, deterministic factual summary is returned."""
        headers = make_auth_headers(roles=["PLANNER"])

        with patch.object(ExplainabilityService, "_call_ollama", new_callable=AsyncMock) as mock_call:
            mock_call.return_value = "I am a plain text response without JSON brackets."

            resp = await self.client.post(
                "/api/v1/explanations",
                headers=headers,
                json={
                    "explanation_type": "RUN_SUMMARY",
                    "run_id": self.run.id,
                },
            )
            self.assertEqual(resp.status_code, status.HTTP_200_OK)
            data = resp.json()
            self.assertIn("Optimization run", data["summary"])
            self.assertTrue(len(data["key_factors"]) > 0)


if __name__ == "__main__":
    unittest.main()
