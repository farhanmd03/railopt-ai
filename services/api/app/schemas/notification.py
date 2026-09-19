"""Notification API schemas (Badge 4)."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class NotificationResponse(BaseModel):
    """Single notification record."""

    model_config = ConfigDict(from_attributes=True)

    id: int = Field(..., description="Notification ID")
    user_id: str | None = Field(None, description="Target user ID")
    notification_type: str = Field(..., description="Notification type code")
    title: str = Field(..., description="Notification title")
    message: str | None = Field(None, description="Notification message body")
    entity_type: str | None = Field(None, description="Related entity type")
    entity_id: str | None = Field(None, description="Related entity ID")
    payload: dict[str, Any] | None = Field(None, description="Additional payload data")
    is_read: bool = Field(False, description="Whether the notification has been read")
    created_at: datetime | None = Field(None, description="Creation timestamp")
    read_at: datetime | None = Field(None, description="When marked as read")


class NotificationListResponse(BaseModel):
    """Paginated notification list with unread count."""

    items: list[NotificationResponse]
    total: int
    unread_count: int
