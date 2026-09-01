"""Resource and resource-availability models.

Resources belong to a department (Engineering, S&T, TRD).
``ResourceAvailability`` extends the base availability window for
date-specific scheduling.
"""

from datetime import date, time

from sqlalchemy import Date, Float, ForeignKey, Integer, String, Text, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Resource(TimestampMixin, Base):
    """Maintenance resource (crew / equipment) belonging to a department."""

    __tablename__ = "resources"

    resource_id: Mapped[str] = mapped_column(String(50), primary_key=True)
    resource_type: Mapped[str | None] = mapped_column(String(100))
    depot: Mapped[str | None] = mapped_column(String(100))
    travel_speed_kmph: Mapped[float | None] = mapped_column(Float)
    availability_window: Mapped[str | None] = mapped_column(String(100))
    department: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )  # Engineering | S&T | TRD
    availability_from: Mapped[time | None] = mapped_column(Time)
    availability_to: Mapped[time | None] = mapped_column(Time)
    team_size: Mapped[int | None] = mapped_column(Integer)
    required_skill: Mapped[str | None] = mapped_column(String(200))
    equipment: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str | None] = mapped_column(String(50), default="Available")
    source_type: Mapped[str | None] = mapped_column(String(50))

    # ── Relationships ────────────────────────────────────────────
    availability_records: Mapped[list["ResourceAvailability"]] = relationship(
        back_populates="resource"
    )


class ResourceAvailability(TimestampMixin, Base):
    """Date-specific availability record for a resource."""

    __tablename__ = "resource_availability"

    id: Mapped[int] = mapped_column(primary_key=True)
    resource_id: Mapped[str] = mapped_column(
        String(50),
        ForeignKey("resources.resource_id"),
        nullable=False,
        index=True,
    )
    date: Mapped[date | None] = mapped_column(Date)
    available_from: Mapped[time | None] = mapped_column(Time)
    available_to: Mapped[time | None] = mapped_column(Time)
    status: Mapped[str | None] = mapped_column(String(50), default="Available")

    # ── Relationships ────────────────────────────────────────────
    resource: Mapped["Resource"] = relationship(
        back_populates="availability_records"
    )
