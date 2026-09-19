"""In-app Notification model — immutable lifecycle event records (Badge 4)."""

from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    JSON,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class NotificationType(PyEnum):
    OPTIMIZATION_COMPLETED = "OPTIMIZATION_COMPLETED"
    APPROVAL_REQUIRED = "APPROVAL_REQUIRED"
    NEGOTIATION_ADJUSTMENT = "NEGOTIATION_ADJUSTMENT"
    BLOCK_APPROVED = "BLOCK_APPROVED"
    BLOCK_REJECTED = "BLOCK_REJECTED"
    READINESS_CHANGE = "READINESS_CHANGE"
    EXECUTION_COMPLETED = "EXECUTION_COMPLETED"
    EXECUTION_DELAYED = "EXECUTION_DELAYED"


class Notification(Base):
    """Immutable in-app notification record.

    Does NOT use TimestampMixin because notifications have their own
    immutable ``created_at`` and should never be updated (only ``is_read``
    and ``read_at`` are mutable).
    """

    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    notification_type: Mapped[NotificationType] = mapped_column(
        Enum(NotificationType), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    entity_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    entity_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )
    read_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
