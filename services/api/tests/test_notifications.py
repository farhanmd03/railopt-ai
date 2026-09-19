"""Test suite for In-App Notifications (Badge 4A)."""

from datetime import datetime, timezone
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
from app.models.notification import Notification, NotificationType


class TestNotificationsEndpoints(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.now = datetime.now(timezone.utc)
        
        self.mock_notification = Notification(
            id=10,
            user_id="planner.demo",
            notification_type=NotificationType.APPROVAL_REQUIRED,
            title="Approval Required",
            message="Please approve run 101",
            is_read=False,
            created_at=self.now,
        )
        
        self.mock_db = AsyncMock()

        async def mock_get(model, pk):
            if model == Notification:
                if pk == 10:
                    return self.mock_notification
            return None

        self.mock_db.get.side_effect = mock_get
        self.mock_db.commit = AsyncMock()
        self.mock_db.refresh = AsyncMock()
        
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = [self.mock_notification]
        self.mock_db.scalars = AsyncMock(return_value=mock_scalars)
        self.mock_db.scalar = AsyncMock(return_value=1)
        self.mock_db.execute = AsyncMock()

        async def override_get_db():
            yield self.mock_db

        app.dependency_overrides[get_db] = override_get_db

    def tearDown(self):
        app.dependency_overrides.clear()

    def test_01_unauthenticated_access(self):
        resp = self.client.get("/api/v1/notifications")
        self.assertEqual(resp.status_code, 401)

    def test_02_list_notifications(self):
        app.dependency_overrides[get_current_user] = lambda: User(
            id="u1", username="planner.demo", roles=["PLANNER"]
        )
        resp = self.client.get("/api/v1/notifications")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["total"], 1)
        self.assertEqual(data["unread_count"], 1)
        self.assertEqual(len(data["items"]), 1)
        self.assertEqual(data["items"][0]["title"], "Approval Required")

    def test_03_get_own_notification(self):
        app.dependency_overrides[get_current_user] = lambda: User(
            id="u1", username="planner.demo", roles=["PLANNER"]
        )
        resp = self.client.get("/api/v1/notifications/10")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["id"], 10)

    def test_04_get_another_users_notification_404(self):
        app.dependency_overrides[get_current_user] = lambda: User(
            id="u2", username="other.user", roles=["VIEWER"]
        )
        resp = self.client.get("/api/v1/notifications/10")
        self.assertEqual(resp.status_code, 404)

    def test_05_mark_one_read(self):
        app.dependency_overrides[get_current_user] = lambda: User(
            id="u1", username="planner.demo", roles=["PLANNER"]
        )
        resp = self.client.patch("/api/v1/notifications/10/read")
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.json()["is_read"])
        
    def test_06_mark_another_users_notification_read_404(self):
        app.dependency_overrides[get_current_user] = lambda: User(
            id="u2", username="other.user", roles=["VIEWER"]
        )
        resp = self.client.patch("/api/v1/notifications/10/read")
        self.assertEqual(resp.status_code, 404)

    def test_07_mark_all_read(self):
        app.dependency_overrides[get_current_user] = lambda: User(
            id="u1", username="planner.demo", roles=["PLANNER"]
        )
        resp = self.client.patch("/api/v1/notifications/read-all")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("message", resp.json())


if __name__ == "__main__":
    unittest.main()