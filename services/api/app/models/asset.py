"""Asset and maintenance-task models.

Departments are stored as validated strings (Engineering, S&T, TRD).
OHE is an ``asset_type``, never a department.
"""

from datetime import date

from sqlalchemy import Date, Float, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Asset(TimestampMixin, Base):
    """Fixed-infrastructure asset (Track, Signal, OHE) within a section."""

    __tablename__ = "assets"

    asset_id: Mapped[str] = mapped_column(String(50), primary_key=True)
    section_id: Mapped[str | None] = mapped_column(
        String(50), ForeignKey("sections.section_id"), index=True
    )
    station_code: Mapped[str | None] = mapped_column(
        String(20), ForeignKey("stations.station_code")
    )
    department: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )  # Engineering | S&T | TRD
    asset_type: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )  # Track | Signal | OHE
    failure_risk_score: Mapped[float | None] = mapped_column(Float)
    criticality_index: Mapped[float | None] = mapped_column(Float)
    last_maintained_date: Mapped[date | None] = mapped_column(Date)
    source_type: Mapped[str | None] = mapped_column(String(50))

    # ── Relationships ────────────────────────────────────────────
    maintenance_tasks: Mapped[list["MaintenanceTask"]] = relationship(
        back_populates="asset"
    )


class MaintenanceTask(TimestampMixin, Base):
    """Maintenance work-order / defect record.

    ``priority_score`` is a synthetic baseline value in the frozen dataset.
    Future ML modules may compute a refined score.
    """

    __tablename__ = "maintenance_tasks"

    task_id: Mapped[str] = mapped_column(String(50), primary_key=True)
    asset_id: Mapped[str | None] = mapped_column(
        String(50), ForeignKey("assets.asset_id"), index=True
    )
    section_id: Mapped[str | None] = mapped_column(
        String(50), ForeignKey("sections.section_id"), index=True
    )
    department: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )  # Engineering | S&T | TRD
    defect_type: Mapped[str | None] = mapped_column(String(200))
    severity: Mapped[str | None] = mapped_column(
        String(20)
    )  # Low | Medium | High | Critical
    reported_date: Mapped[date | None] = mapped_column(Date)
    days_overdue: Mapped[int | None] = mapped_column(Integer)
    required_duration_hrs: Mapped[float | None] = mapped_column(Numeric(6, 2))
    postpone_penalty_cost: Mapped[float | None] = mapped_column(Numeric(12, 2))
    priority_score: Mapped[float | None] = mapped_column(Float)
    status: Mapped[str | None] = mapped_column(
        String(50), default="Open"
    )  # Open | InProgress | Completed | Cancelled
    source_type: Mapped[str | None] = mapped_column(String(50))

    # ── Relationships ────────────────────────────────────────────
    asset: Mapped["Asset | None"] = relationship(
        back_populates="maintenance_tasks"
    )
