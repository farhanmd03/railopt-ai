"""Possession Outcome Ledger model — tracks planned vs actual block execution (Badge 4)."""

from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import (
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class PossessionOutcomeStatus(PyEnum):
    PLANNED = "PLANNED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    DELAYED = "DELAYED"


class PossessionOutcome(TimestampMixin, Base):
    """Record of a possession block's planned vs actual execution outcome.

    Captures governance data: planned/actual times, delays, cancellations,
    affected departments, and impact scores for post-hoc analysis.
    """

    __tablename__ = "possession_outcomes"

    id: Mapped[int] = mapped_column(primary_key=True)
    optimized_block_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("optimized_blocks.id"),
        nullable=False,
        index=True,
    )
    planned_start: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    planned_end: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    actual_start: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    actual_end: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    status: Mapped[PossessionOutcomeStatus] = mapped_column(
        Enum(PossessionOutcomeStatus),
        nullable=False,
        server_default="PLANNED",
    )
    delay_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    cancellation_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    affected_departments: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    planned_impact_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    actual_impact_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    recorded_by: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Relationship back to the block
    optimized_block: Mapped["OptimizedBlock"] = relationship("OptimizedBlock")
