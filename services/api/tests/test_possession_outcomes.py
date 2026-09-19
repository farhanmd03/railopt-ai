"""Test suite for Possession Outcome Ledger (Badge 4B)."""

from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import AsyncMock, MagicMock

from starlette.testclient import TestClient

API_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = API_DIR.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))
sys.path.insert(0, str(API_DIR))

from app.core.database import get_db
from app.core.security import User, get_current_user
from app.main import app
from app.models.admin import AuditLog
from app.models.optimization import OptimizedBlock
from app.models.possession_outcome import PossessionOutcome, PossessionOutcomeStatus


class TestPossessionOutcomesEndpoints(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.now = datetime.now(timezone.utc)
        
        self.mock_block = OptimizedBlock(
            id=101,
            optimization_run_id=1,
            block_start=self.now,
            block_end=self.now + timedelta(hours=4),
            status="APPROVED",
        )

        self.mock_outcome = PossessionOutcome(
            id=50,
            optimized_block_id=101,
            planned_start=self.now,
            planned_end=self.now + timedelta(hours=4),
            status=PossessionOutcomeStatus.PLANNED,
            recorded_by="planner.demo",
            created_at=self.now,
            updated_at=self.now,
        )

        self.mock_db = AsyncMock()

        async def mock_get(model, pk):
            if model == OptimizedBlock:
                if pk == 101:
                    return self.mock_block
            elif model == PossessionOutcome:
                if pk == 50:
                    return self.mock_outcome
            return None

        self.mock_db.get.side_effect = mock_get
        
        self.added_objects = []
        def mock_add(obj):
            if isinstance(obj, PossessionOutcome) and getattr(obj, "id", None) is None:
                obj.id = 51
            self.added_objects.append(obj)
            
        self.mock_db.add = MagicMock(side_effect=mock_add)
        self.mock_db.commit = AsyncMock()
        self.mock_db.flush = AsyncMock()
        
        async def mock_refresh(obj):
            pass
        self.mock_db.refresh = AsyncMock(side_effect=mock_refresh)

        # For queries expecting empty or single results
        def mock_scalars(stmt):
            mock_res = MagicMock()
            if "optimized_block_id == :optimized_block_id_1" in str(stmt):
                # Simulated for the "does outcome already exist" check during creation
                # If block_id is 101, we pretend it doesn't exist for the create test to pass
                mock_res.first.return_value = None
                mock_res.all.return_value = [self.mock_outcome]
            else:
                mock_res.first.return_value = None
                mock_res.all.return_value = []
            return mock_res
            
        self.mock_db.scalars = AsyncMock(side_effect=mock_scalars)

        async def override_get_db():
            yield self.mock_db

        app.dependency_overrides[get_db] = override_get_db

    def tearDown(self):
        app.dependency_overrides.clear()

    def test_01_create_possession_outcome_auth_required(self):
        resp = self.client.post(
            "/api/v1/optimization/blocks/101/possession-outcomes",
            json={
                "planned_start": self.now.isoformat(),
                "planned_end": (self.now + timedelta(hours=4)).isoformat(),
                "status": "PLANNED",
            },
        )
        self.assertEqual(resp.status_code, 401)

    def test_02_create_possession_outcome_insufficient_role(self):
        app.dependency_overrides[get_current_user] = lambda: User(
            id="u2", username="viewer.demo", roles=["VIEWER"]
        )
        resp = self.client.post(
            "/api/v1/optimization/blocks/101/possession-outcomes",
            json={
                "planned_start": self.now.isoformat(),
                "planned_end": (self.now + timedelta(hours=4)).isoformat(),
                "status": "PLANNED",
            },
        )
        self.assertEqual(resp.status_code, 403)

    def test_03_create_possession_outcome_success(self):
        app.dependency_overrides[get_current_user] = lambda: User(
            id="u1", username="planner.demo", roles=["PLANNER"]
        )
        payload = {
            "planned_start": self.now.isoformat(),
            "planned_end": (self.now + timedelta(hours=4)).isoformat(),
            "status": "PLANNED",
            "affected_departments": ["ENGINEERING", "TRD"],
            "notes": "Initial setup",
        }
        
        resp = self.client.post(
            "/api/v1/optimization/blocks/101/possession-outcomes",
            json=payload,
        )
        self.assertEqual(resp.status_code, 201)
        data = resp.json()
        self.assertEqual(data["status"], "PLANNED")
        self.assertEqual(data["recorded_by"], "planner.demo")
        self.assertEqual(data["affected_departments"], ["ENGINEERING", "TRD"])

        # Check Audit Log creation
        audit_logs = [obj for obj in self.added_objects if isinstance(obj, AuditLog)]
        self.assertEqual(len(audit_logs), 1)
        self.assertEqual(audit_logs[0].action, "POSSESSION_OUTCOME_CREATED")

    def test_04_get_possession_outcome(self):
        app.dependency_overrides[get_current_user] = lambda: User(
            id="u1", username="viewer.demo", roles=["VIEWER"]
        )
        resp = self.client.get("/api/v1/possession-outcomes/50")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["id"], 50)
        self.assertEqual(resp.json()["optimized_block_id"], 101)

    def test_05_update_possession_outcome(self):
        app.dependency_overrides[get_current_user] = lambda: User(
            id="u1", username="planner.demo", roles=["PLANNER"]
        )
        
        actual_start_time = self.now + timedelta(minutes=15)
        resp = self.client.patch(
            "/api/v1/possession-outcomes/50",
            json={
                "status": "IN_PROGRESS",
                "actual_start": actual_start_time.isoformat(),
                "delay_minutes": 15,
                "notes": "Started 15m late due to freight passage",
            },
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["status"], "IN_PROGRESS")
        self.assertEqual(data["delay_minutes"], 15)
        
        # Verify Audit Log captures before/after appropriately
        audit_logs = [obj for obj in self.added_objects if isinstance(obj, AuditLog)]
        self.assertTrue(len(audit_logs) >= 1)
        self.assertEqual(audit_logs[-1].action, "POSSESSION_OUTCOME_UPDATED")
        after_val = json.loads(audit_logs[-1].after_value)
        self.assertEqual(after_val["status"], "IN_PROGRESS")
        self.assertEqual(after_val["delay_minutes"], 15)


if __name__ == "__main__":
    unittest.main()