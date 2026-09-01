"""Corridor-window and freight-forecast models.

Corridor windows use full ``DateTime`` because they represent specific
date+time maintenance availability slots.
"""

from datetime import date, datetime

from sqlalchemy import (
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class CorridorWindow(TimestampMixin, Base):
    """Available maintenance window on a section."""

    __tablename__ = "corridor_windows"

    window_id: Mapped[str] = mapped_column(String(50), primary_key=True)
    section_id: Mapped[str | None] = mapped_column(
        String(50), ForeignKey("sections.section_id"), index=True
    )
    window_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    window_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    duration_mins: Mapped[int | None] = mapped_column(Integer)
    window_type: Mapped[str | None] = mapped_column(String(50))
    window_status: Mapped[str | None] = mapped_column(String(50))
    freight_level: Mapped[str | None] = mapped_column(String(50))
    source_type: Mapped[str | None] = mapped_column(String(50))


class FreightForecast(TimestampMixin, Base):
    """Freight demand forecast for a section on a specific date."""

    __tablename__ = "freight_forecasts"

    id: Mapped[int] = mapped_column(primary_key=True)
    section_id: Mapped[str | None] = mapped_column(
        String(50), ForeignKey("sections.section_id"), index=True
    )
    date: Mapped[date | None] = mapped_column(Date, index=True)
    forecast_freight_trains: Mapped[int | None] = mapped_column(Integer)
    forecast_tonnage: Mapped[float | None] = mapped_column(Numeric(12, 2))
    source_type: Mapped[str | None] = mapped_column(String(50))
    forecast_confidence: Mapped[float | None] = mapped_column(Float)
    traffic_level: Mapped[str | None] = mapped_column(String(50))

    __table_args__ = (
        UniqueConstraint(
            "section_id", "date", name="uq_freight_forecast_section_date"
        ),
    )
