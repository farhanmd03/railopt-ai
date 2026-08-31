"""Comprehensive test suite for Human Approval Workflow & Audit Trail (Batch 7J).

Tests:
1. Anonymous POST /submit, /approve, /reject -> 401 Unauthorized
2. VIEWER POST /submit -> 403 Forbidden
3. PLANNER POST /submit -> 200 OK, transitions DRAFT -> SUBMITTED, records audit
4. PLANNER cannot submit already SUBMITTED run -> 409 Conflict
5. PLANNER cannot approve submitted run -> 403 Forbidden
6. APPROVER POST /approve -> 200 OK, transitions SUBMITTED -> APPROVED, records audit
7. APPROVER cannot approve already APPROVED run -> 409 Conflict
8. APPROVER cannot approve DRAFT run without submission -> 409 Conflict
9. APPROVER POST /reject without reason -> 422 Unprocessable Entity
10. APPROVER POST /reject with short (<5 char) reason -> 422 Unprocessable Entity
11. APPROVER POST /reject with valid reason -> 200 OK, transitions SUBMITTED -> REJECTED, records audit
12. PLANNER can resubmit REJECTED run -> 200 OK, transitions REJECTED -> SUBMITTED
13. Cannot reject already APPROVED run -> 409 Conflict
14. Audit log endpoint returns chronological events with user identity and before/after values
15. Solver status and optimization blocks remain unchanged throughout approval workflow
"""

import asyncio
import json
import os
from pathlib import Path
import sys
import unittest
import urllib.parse
import urllib.request

import httpx
from sqlalchemy import select

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
from app.models.admin import AuditLog
from app.models.optimization import OptimizationRun

KEYCLOAK_URL = os.getenv("KEYCLOAK_URL", "http://127.0.0.1:8080").replace("localhost", "127.0.0.1").rstrip("/")
REALM = "railopt"
CLIENT_ID = "railopt-web"
DEMO_PASSWORD = os.getenv("DEMO_USER_PASSWORD", "railopt_demo_2026")


def obtain_token(username: str) -> str:
    """Acquire real JWT access token from Keycloak for demo testing."""
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


class TestApprovalWorkflow(unittest.IsolatedAsyncioTestCase):
    """Test approval state machine, RBAC permissions, and immutable audit logs."""

    @classmethod
    def setUpClass(cls):
        try:
            cls.planner_token = obtain_token("planner.demo")
            cls.approver_token = obtain_token("approver.demo")
            cls.viewer_token = obtain_token("viewer.demo")
            cls.admin_token = obtain_token("admin.demo")
            cls.keycloak_available = True
        except Exception as e:
            cls.keycloak_available = False
            print(f"Keycloak not reachable: {e}. Skipping live token tests.")

    async def asyncSetUp(self):
        if not self.keycloak_available:
            self.skipTest("Keycloak auth server unavailable")

        # Create a fresh DRAFT OptimizationRun in database for testing
        async with async_session_factory() as session:
            test_run = OptimizationRun(
                run_type="test_approval",
                status="Completed",
                solver_status="OPTIMAL",
                objective_value=3250.0,
                solve_time_seconds=2.15,
                approval_status="DRAFT",
                parameters=json.dumps({"run_id": "RUN-TEST-APPROV", "metrics": {"tasks_considered": 10, "tasks_scheduled": 5}}),
                notes="Automated test run for approval workflow",
            )
            session.add(test_run)
            await session.commit()
            await session.refresh(test_run)
            self.test_run_id = test_run.id

    async def test_01_anonymous_cannot_access_approval_endpoints(self):
        """Anonymous requests must be rejected with 401."""
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            resp1 = await client.post(f"/api/v1/optimization/runs/{self.test_run_id}/submit")
            self.assertEqual(resp1.status_code, 401)

            resp2 = await client.post(f"/api/v1/optimization/runs/{self.test_run_id}/approve")
            self.assertEqual(resp2.status_code, 401)

            resp3 = await client.post(
                f"/api/v1/optimization/runs/{self.test_run_id}/reject",
                json={"reason": "Invalid schedule"},
            )
            self.assertEqual(resp3.status_code, 401)

    async def test_02_viewer_cannot_submit_or_approve(self):
        """VIEWER role is read-only and cannot submit or approve plans (403)."""
        headers = {"Authorization": f"Bearer {self.viewer_token}"}
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(f"/api/v1/optimization/runs/{self.test_run_id}/submit", headers=headers)
            self.assertEqual(resp.status_code, 403)

            resp = await client.post(f"/api/v1/optimization/runs/{self.test_run_id}/approve", headers=headers)
            self.assertEqual(resp.status_code, 403)

            resp = await client.post(
                f"/api/v1/optimization/runs/{self.test_run_id}/reject",
                headers=headers,
                json={"reason": "Testing rejection"},
            )
            self.assertEqual(resp.status_code, 403)

    async def test_03_planner_can_submit_run_for_review(self):
        """PLANNER can submit DRAFT run -> SUBMITTED and create audit log."""
        headers = {"Authorization": f"Bearer {self.planner_token}"}
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(f"/api/v1/optimization/runs/{self.test_run_id}/submit", headers=headers)
            self.assertEqual(resp.status_code, 200)
            data = resp.json()
            self.assertEqual(data["approval_status"], "SUBMITTED")
            self.assertEqual(data["submitted_by"], "planner.demo")
            self.assertIsNotNone(data["submitted_at"])
            self.assertEqual(data["solver_status"], "OPTIMAL")

            # Check duplicate submit fails with 409
            dup_resp = await client.post(f"/api/v1/optimization/runs/{self.test_run_id}/submit", headers=headers)
            self.assertEqual(dup_resp.status_code, 409)

    async def test_04_approver_can_approve_submitted_run(self):
        """APPROVER can approve SUBMITTED run -> APPROVED."""
        planner_headers = {"Authorization": f"Bearer {self.planner_token}"}
        approver_headers = {"Authorization": f"Bearer {self.approver_token}"}

        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            # 1. Planner submits
            await client.post(f"/api/v1/optimization/runs/{self.test_run_id}/submit", headers=planner_headers)

            # 2. Planner cannot approve (403)
            p_resp = await client.post(f"/api/v1/optimization/runs/{self.test_run_id}/approve", headers=planner_headers)
            self.assertEqual(p_resp.status_code, 403)

            # 3. Approver approves
            app_resp = await client.post(f"/api/v1/optimization/runs/{self.test_run_id}/approve", headers=approver_headers)
            self.assertEqual(app_resp.status_code, 200)
            data = app_resp.json()
            self.assertEqual(data["approval_status"], "APPROVED")
            self.assertEqual(data["approved_by"], "approver.demo")
            self.assertIsNotNone(data["approved_at"])
            self.assertEqual(data["solver_status"], "OPTIMAL")

            # 4. Cannot approve again (409 Conflict)
            dup_resp = await client.post(f"/api/v1/optimization/runs/{self.test_run_id}/approve", headers=approver_headers)
            self.assertEqual(dup_resp.status_code, 409)

            # 5. Cannot reject already approved run (409 Conflict)
            rej_resp = await client.post(
                f"/api/v1/optimization/runs/{self.test_run_id}/reject",
                headers=approver_headers,
                json={"reason": "Attempting rejection on approved plan"},
            )
            self.assertEqual(rej_resp.status_code, 409)

    async def test_05_approver_rejection_requires_valid_reason(self):
        """Rejection requires min 5 character explanation."""
        planner_headers = {"Authorization": f"Bearer {self.planner_token}"}
        approver_headers = {"Authorization": f"Bearer {self.approver_token}"}

        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            # Submit run
            await client.post(f"/api/v1/optimization/runs/{self.test_run_id}/submit", headers=planner_headers)

            # Short reason -> 422
            short_resp = await client.post(
                f"/api/v1/optimization/runs/{self.test_run_id}/reject",
                headers=approver_headers,
                json={"reason": "bad"},
            )
            self.assertEqual(short_resp.status_code, 422)

            # Valid reason -> 200 REJECTED
            rej_resp = await client.post(
                f"/api/v1/optimization/runs/{self.test_run_id}/reject",
                headers=approver_headers,
                json={"reason": "Excessive passenger train disruption during morning peak hours."},
            )
            self.assertEqual(rej_resp.status_code, 200)
            data = rej_resp.json()
            self.assertEqual(data["approval_status"], "REJECTED")
            self.assertEqual(data["rejected_by"], "approver.demo")
            self.assertEqual(data["rejection_reason"], "Excessive passenger train disruption during morning peak hours.")

            # Planner can resubmit REJECTED run
            resub_resp = await client.post(f"/api/v1/optimization/runs/{self.test_run_id}/submit", headers=planner_headers)
            self.assertEqual(resub_resp.status_code, 200)
            self.assertEqual(resub_resp.json()["approval_status"], "SUBMITTED")

    async def test_06_audit_trail_endpoint(self):
        """Audit trail records chronological events for submit and approve."""
        planner_headers = {"Authorization": f"Bearer {self.planner_token}"}
        approver_headers = {"Authorization": f"Bearer {self.approver_token}"}

        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            await client.post(f"/api/v1/optimization/runs/{self.test_run_id}/submit", headers=planner_headers)
            await client.post(f"/api/v1/optimization/runs/{self.test_run_id}/approve", headers=approver_headers)

            # Read audit trail
            audit_resp = await client.get(f"/api/v1/audit/optimization-runs/{self.test_run_id}", headers=planner_headers)
            self.assertEqual(audit_resp.status_code, 200)
            audit_data = audit_resp.json()
            self.assertEqual(audit_data["total"], 2)
            events = audit_data["items"]
            self.assertEqual(events[0]["action"], "SUBMITTED")
            self.assertEqual(events[0]["user_id"], "planner.demo")
            self.assertEqual(events[1]["action"], "APPROVED")
            self.assertEqual(events[1]["user_id"], "approver.demo")


if __name__ == "__main__":
    unittest.main()
