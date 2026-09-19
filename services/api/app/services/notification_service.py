"""Backend Notification Service (Badge 4A)."""

from typing import Any
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification, NotificationType


async def create_notification(
    db: AsyncSession,
    user_id: str,
    notification_type: NotificationType,
    title: str,
    message: str | None = None,
    entity_type: str | None = None,
    entity_id: str | None = None,
    payload: dict[str, Any] | None = None,
) -> Notification:
    """Create and attach a Notification record to the current transaction.
    
    This function adds the notification to the current AsyncSession but
    does NOT independently commit it, allowing the caller to safely 
    commit the transaction alongside related state changes.
    """
    notification = Notification(
        user_id=user_id,
        notification_type=notification_type,
        title=title,
        message=message,
        entity_type=entity_type,
        entity_id=entity_id,
        payload=payload,
    )
    db.add(notification)
    return notification