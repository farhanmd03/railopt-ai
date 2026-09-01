"""Block-request models — incoming maintenance block requests from departments.

A ``BlockRequest`` is a department's request for a maintenance block.
``BlockRequestTask`` is the junction linking a request to one or more
``MaintenanceTask`` records.

These are *inputs* to the optimizer — distinct from ``OptimizedBlock``
which represents the optimizer's *output*.
"""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class BlockRequest(TimestampMixin, Base):
    """A department's request for a maintenance block on a section."""

    __tablename__ = "block_requests"

    request_id: Mapped[str] = mapped_column(String(50), primary_key=True)
    department: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )  # Engineering | S&T | TRD
    section_id: Mapped[str | None] = mapped_column(
        String(50), ForeignKey("sections.section_id"), index=True
    )
    requested_start: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )
    requested_duration_hrs: Mapped[float | None] = mapped_column(Numeric(6, 2))
    status: Mapped[str | None] = mapped_column(
        String(50), default="Pending"
    )  # Pending | Approved | Rejected | Cancelled

    # ── Relationships ────────────────────────────────────────────
    tasks: Mapped[list["BlockRequestTask"]] = relationship(
        back_populates="block_request"
    )


class BlockRequestTask(TimestampMixin, Base):
    """Junction linking a block request to specific maintenance tasks."""

    __tablename__ = "block_request_tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    request_id: Mapped[str] = mapped_column(
        String(50),
        ForeignKey("block_requests.request_id"),
        nullable=False,
        index=True,
    )
    task_id: Mapped[str] = mapped_column(
        String(50),
        ForeignKey("maintenance_tasks.task_id"),
        nullable=False,
        index=True,
    )

    # ── Relationships ────────────────────────────────────────────
    block_request: Mapped["BlockRequest"] = relationship(
        back_populates="tasks"
    )

    __table_args__ = (
        UniqueConstraint(
            "request_id", "task_id", name="uq_block_request_task"
        ),
    )
