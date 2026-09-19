"""Comprehensive test suite for Multi-Department Negotiation (Badge 2).

Tests:
1. Schema Validation:
   - ACCEPT without category/payload is valid
   - ADJUST with valid category and {value, reason} payload is valid
   - ADJUST missing category raises ValidationError
   - ADJUST missing value or reason raises ValidationError
   - ADJUST with non-string fields raises ValidationError
   - Department normalization ("ENGINEERING", "SNT", "TRD", "S&T")

2. Endpoint Access & RBAC:
   - Anonymous POST /negotiate -> 401
   - Disallowed roles (e.g. VIEWER, PLANNER) POST /negotiate -> 403
   - Negotiator role with mismatched department -> 403
   - Valid negotiator role with matching department -> 200

3. Business Logic:
   - Negotiating non-existent block -> 404
   - Negotiating finalized block (APPROVED or REJECTED) -> 409
   - ACCEPT records NegotiationLog and AuditLog (action="NEGOTIATION_ACCEPT")
   - ADJUST records NegotiationLog and AuditLog (action="NEGOTIATION_ADJUST")
   - REJECT records NegotiationLog and AuditLog (action="NEGOTIATION_REJECT")
   - GET /negotiations retrieves chronological history
   - Negotiation does NOT alter OptimizationRun approval_status
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
from app.models.admin import AuditLog
from app.models.negotiation import AdjustmentCategory, NegotiationAction, NegotiationLog
from app.models.optimization import OptimizationRun, OptimizedBlock
from app.schemas.optimization import NegotiationRequest, NegotiationResponse


class TestNegotiationSchemas(unittest.TestCase):
    """Unit tests for Pydantic negotiation request & response schemas."""

    def test_accept_payload_valid(self):
        req = NegotiationRequest(
            department="ENGINEERING",
            action=NegotiationAction.ACCEPT,
            comment="Approved by P-Way team",
        )
        self.assertEqual(req.department, "ENGINEERING")
        self.assertEqual(req.action, NegotiationAction.ACCEPT)
        self.assertIsNone(req.adjustment_category)
        self.assertIsNone(req.adjustment_payload)

    def test_department_normalization(self):
        req1 = NegotiationRequest(
            department="S&T",
            action=NegotiationAction.ACCEPT,
        )
        self.assertEqual(req1.department, "SNT")

        req2 = NegotiationRequest(
            department="engg",
            action=NegotiationAction.ACCEPT,
        )
        self.assertEqual(req2.department, "ENGINEERING")

        req3 = NegotiationRequest(
            department="traction",
            action=NegotiationAction.ACCEPT,
        )
        self.assertEqual(req3.department, "TRD")

    def test_adjust_payload_valid(self):
        req = NegotiationRequest(
            department="TRD",
            action=NegotiationAction.ADJUST,
            adjustment_category=AdjustmentCategory.TIME_CHANGE,
            adjustment_payload={
                "value": "Shift block start to 02:00 UTC",
                "reason": "OHE power block window alignment",
            },
            comment="Requesting 1hr delay",
        )
        self.assertEqual(req.action, NegotiationAction.ADJUST)
        self.assertEqual(req.adjustment_category, AdjustmentCategory.TIME_CHANGE)
        self.assertEqual(req.adjustment_payload["value"], "Shift block start to 02:00 UTC")

    def test_adjust_payload_missing_category(self):
        with self.assertRaises(ValidationError):
            NegotiationRequest(
                department="SNT",
                action=NegotiationAction.ADJUST,
                adjustment_payload={"value": "New window", "reason": "Interlocking testing"},
            )

    def test_adjust_payload_missing_keys(self):
        with self.assertRaises(ValidationError):
            NegotiationRequest(
                department="SNT",
                action=NegotiationAction.ADJUST,
                adjustment_category=AdjustmentCategory.RESOURCE_CONCERN,
                adjustment_payload={"value": "Need 2 tower wagons"},
            )

    def test_adjust_payload_non_string_values(self):
        with self.assertRaises(ValidationError):
            NegotiationRequest(
                department="ENGINEERING",
                action=NegotiationAction.ADJUST,
                adjustment_category=AdjustmentCategory.DURATION_CHANGE,
                adjustment_payload={"value": 120, "reason": "Track renewal"},
            )

    def test_adjust_payload_empty_strings(self):
        with self.assertRaises(ValidationError):
            NegotiationRequest(
                department="ENGINEERING",
                action=NegotiationAction.ADJUST,
                adjustment_category=AdjustmentCategory.DURATION_CHANGE,
                adjustment_payload={"value": "", "reason": "   "},
            )


class TestNegotiationEndpoints(unittest.TestCase):
    """Test suite for negotiation endpoints using TestClient and mock db session."""

    def setUp(self):
        self.client = TestClient(app)
        self.now = datetime.now(timezone.utc)

        # Mock objects
        self.mock_run = OptimizationRun(
            id=101,
            run_type="standard",
            status="Completed",
            solver_status="OPTIMAL",
            approval_status="DRAFT",
        )

        self.mock_active_block = OptimizedBlock(
            id=201,
            optimization_run_id=101,
            block_start=self.now,
            block_end=self.now + timedelta(hours=4),
            block_duration_hrs=4.0,
            block_type="integrated",
            is_integrated=True,
            departments_involved="Engineering,SNT,TRD",
            status="Candidate",
        )

        self.mock_finalized_block = OptimizedBlock(
            id=202,
            optimization_run_id=101,
            block_start=self.now,
            block_end=self.now + timedelta(hours=4),
            block_duration_hrs=4.0,
            block_type="single",
            is_integrated=False,
            departments_involved="Engineering",
            status="APPROVED",
        )

        # Create mock db session
        self.mock_db = AsyncMock()

        async def mock_get(model, pk):
            if model == OptimizedBlock:
                if pk == 201:
                    return self.mock_active_block
                elif pk == 202:
                    return self.mock_finalized_block
                return None
            elif model == OptimizationRun:
                if pk == 101:
                    return self.mock_run
                return None
            return None

        self.mock_db.get.side_effect = mock_get
        self.added_objects = []

        def mock_add(obj):
            if isinstance(obj, NegotiationLog) and getattr(obj, "id", None) is None:
                obj.id = 501
            self.added_objects.append(obj)

        self.mock_db.add = MagicMock(side_effect=mock_add)
        self.mock_db.flush = AsyncMock()
        self.mock_db.commit = AsyncMock()

        async def mock_refresh(obj):
            if isinstance(obj, NegotiationLog) and getattr(obj, "id", None) is None:
                obj.id = 501

        self.mock_db.refresh = AsyncMock(side_effect=mock_refresh)

        # Mock scalars for get_block_negotiations
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = [
            NegotiationLog(
                id=501,
                optimized_block_id=201,
                department="ENGINEERING",
                action=NegotiationAction.ACCEPT,
                comment="Initial review",
                performed_by="engg.demo",
                timestamp=self.now,
            )
        ]
        self.mock_db.scalars = AsyncMock(return_value=mock_scalars)

        # Override get_db
        async def override_get_db():
            yield self.mock_db

        app.dependency_overrides[get_db] = override_get_db

    def tearDown(self):
        app.dependency_overrides.clear()

    def test_01_negotiate_anonymous_unauthorized(self):
        resp = self.client.post(
            "/api/v1/optimization/blocks/201/negotiate",
            json={"department": "ENGINEERING", "action": "ACCEPT"},
        )
        self.assertEqual(resp.status_code, 401)

    def test_02_negotiate_non_negotiator_role_forbidden(self):
        app.dependency_overrides[get_current_user] = lambda: User(
            id="u1", username="viewer.demo", roles=["VIEWER"]
        )
        resp = self.client.post(
            "/api/v1/optimization/blocks/201/negotiate",
            json={"department": "ENGINEERING", "action": "ACCEPT"},
        )
        self.assertEqual(resp.status_code, 403)

    def test_03_negotiate_mismatched_department_forbidden(self):
        app.dependency_overrides[get_current_user] = lambda: User(
            id="u2", username="snt.demo", roles=["SNT"]
        )
        resp = self.client.post(
            "/api/v1/optimization/blocks/201/negotiate",
            json={"department": "ENGINEERING", "action": "ACCEPT"},
        )
        self.assertEqual(resp.status_code, 403)
        self.assertIn("not authorized", resp.json()["detail"])

    def test_04_negotiate_non_existent_block_404(self):
        app.dependency_overrides[get_current_user] = lambda: User(
            id="u3", username="engg.demo", roles=["ENGINEERING"]
        )
        resp = self.client.post(
            "/api/v1/optimization/blocks/99999999/negotiate",
            json={"department": "ENGINEERING", "action": "ACCEPT"},
        )
        self.assertEqual(resp.status_code, 404)

    def test_05_negotiate_finalized_block_409(self):
        app.dependency_overrides[get_current_user] = lambda: User(
            id="u3", username="engg.demo", roles=["ENGINEERING"]
        )
        resp = self.client.post(
            "/api/v1/optimization/blocks/202/negotiate",
            json={"department": "ENGINEERING", "action": "ACCEPT"},
        )
        self.assertEqual(resp.status_code, 409)
        self.assertIn("already finalized", resp.json()["detail"])

    def test_06_negotiate_accept_success_and_audit(self):
        app.dependency_overrides[get_current_user] = lambda: User(
            id="u3", username="engg.demo", roles=["ENGINEERING"]
        )
        resp = self.client.post(
            "/api/v1/optimization/blocks/201/negotiate",
            json={
                "department": "ENGINEERING",
                "action": "ACCEPT",
                "comment": "P-Way track machines ready",
            },
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["action"], "ACCEPT")
        self.assertEqual(data["department"], "ENGINEERING")
        self.assertEqual(data["performed_by"], "engg.demo")
        self.assertEqual(data["optimized_block_id"], 201)

        # Verify AuditLog created
        audit_logs = [obj for obj in self.added_objects if isinstance(obj, AuditLog)]
        self.assertEqual(len(audit_logs), 1)
        self.assertEqual(audit_logs[0].action, "NEGOTIATION_ACCEPT")
        self.assertEqual(audit_logs[0].entity_type, "NegotiationLog")
        self.assertEqual(audit_logs[0].user_id, "engg.demo")

        # Optimization run approval_status remains unchanged
        self.assertEqual(self.mock_run.approval_status, "DRAFT")

    def test_07_negotiate_adjust_success(self):
        app.dependency_overrides[get_current_user] = lambda: User(
            id="u4", username="trd.demo", roles=["TRD"]
        )
        resp = self.client.post(
            "/api/v1/optimization/blocks/201/negotiate",
            json={
                "department": "TRD",
                "action": "ADJUST",
                "adjustment_category": "TIME_CHANGE",
                "adjustment_payload": {
                    "value": "Postpone start by 30 mins",
                    "reason": "OHE power isolator switching schedule",
                },
                "comment": "Needs 30min delay",
            },
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["action"], "ADJUST")
        self.assertEqual(data["adjustment_category"], "TIME_CHANGE")
        self.assertEqual(data["adjustment_payload"]["value"], "Postpone start by 30 mins")

        # Verify AuditLog created
        audit_logs = [obj for obj in self.added_objects if isinstance(obj, AuditLog)]
        self.assertEqual(len(audit_logs), 1)
        self.assertEqual(audit_logs[0].action, "NEGOTIATION_ADJUST")

    def test_08_negotiate_reject_success(self):
        app.dependency_overrides[get_current_user] = lambda: User(
            id="u2", username="snt.demo", roles=["SNT"]
        )
        resp = self.client.post(
            "/api/v1/optimization/blocks/201/negotiate",
            json={
                "department": "SNT",
                "action": "REJECT",
                "comment": "Axle counter testing clash on downstream line",
            },
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["action"], "REJECT")

        audit_logs = [obj for obj in self.added_objects if isinstance(obj, AuditLog)]
        self.assertEqual(len(audit_logs), 1)
        self.assertEqual(audit_logs[0].action, "NEGOTIATION_REJECT")

    def test_09_get_negotiations_history(self):
        app.dependency_overrides[get_current_user] = lambda: User(
            id="u1", username="viewer.demo", roles=["VIEWER"]
        )
        resp = self.client.get("/api/v1/optimization/blocks/201/negotiations")
        self.assertEqual(resp.status_code, 200)
        items = resp.json()
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["comment"], "Initial review")
        self.assertEqual(items[0]["action"], "ACCEPT")


if __name__ == "__main__":
    unittest.main()
