"""Negotiation models – per OptimizedBlock department review records."""

from datetime import datetime

from sqlalchemy import (
    String,
    Text,
    Enum,
    JSON,
    ForeignKey,
    DateTime,
    Integer,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

# Enum for action types
from enum import Enum as PyEnum

class NegotiationAction(PyEnum):
    ACCEPT = "ACCEPT"
    ADJUST = "ADJUST"
    REJECT = "REJECT"

class AdjustmentCategory(PyEnum):
    TIME_CHANGE = "TIME_CHANGE"
    DURATION_CHANGE = "DURATION_CHANGE"
    RESOURCE_CONCERN = "RESOURCE_CONCERN"
    TRAIN_CONFLICT = "TRAIN_CONFLICT"
    READINESS_CONCERN = "READINESS_CONCERN"
    OTHER = "OTHER"

class NegotiationLog(TimestampMixin, Base):
    """Record of a department's negotiation action for a specific OptimizedBlock.

    This sits between the optimizer recommendation and the final human approval.
    """

    __tablename__ = "negotiation_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    optimized_block_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("optimized_blocks.id"),
        nullable=False,
        index=True,
    )
    department: Mapped[str] = mapped_column(String(100), nullable=False)
    action: Mapped[NegotiationAction] = mapped_column(
        Enum(NegotiationAction), nullable=False
    )
    comment: Mapped[str | None] = mapped_column(Text)
    adjustment_category: Mapped[AdjustmentCategory | None] = mapped_column(
        Enum(AdjustmentCategory), nullable=True
    )
    adjustment_payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    performed_by: Mapped[str] = mapped_column(String(100), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )

    # Relationship back to the block
    optimized_block: Mapped["OptimizedBlock"] = relationship(
        "OptimizedBlock", back_populates="negotiations"
    )


class DepartmentMessage(TimestampMixin, Base):
    """Real-time inter-department communication message for an optimized block."""

    __tablename__ = "department_messages"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    optimized_block_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("optimized_blocks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    department: Mapped[str] = mapped_column(String(100), nullable=False)
    actor: Mapped[str] = mapped_column(String(100), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    message_type: Mapped[str | None] = mapped_column(String(50), default="CHAT")
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
