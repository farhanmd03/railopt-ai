"""Train-operations models: TrainRun and TrainSectionOccupancy.

Train times use ``Time`` because the timetable represents a repeating daily
schedule.  ``track_id`` may contain "TRACK-UNSPECIFIED" in the frozen dataset.
"""

from datetime import time

from sqlalchemy import ForeignKey, Integer, String, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class TrainRun(TimestampMixin, Base):
    """A specific train's passage through a section (timetable entry)."""

    __tablename__ = "train_runs"

    run_id: Mapped[str] = mapped_column(String(50), primary_key=True)
    train_no: Mapped[str] = mapped_column(
        String(20), nullable=False, index=True
    )
    train_name: Mapped[str | None] = mapped_column(String(200))
    train_type: Mapped[str | None] = mapped_column(String(50), index=True)
    section_id: Mapped[str | None] = mapped_column(
        String(50), ForeignKey("sections.section_id"), index=True
    )
    from_station_code: Mapped[str | None] = mapped_column(
        String(20), ForeignKey("stations.station_code")
    )
    to_station_code: Mapped[str | None] = mapped_column(
        String(20), ForeignKey("stations.station_code")
    )
    entry_time: Mapped[time | None] = mapped_column(Time)
    exit_time: Mapped[time | None] = mapped_column(Time)
    priority_rank: Mapped[int | None] = mapped_column(Integer)
    slack_time_window_mins: Mapped[int | None] = mapped_column(Integer)
    source_type: Mapped[str | None] = mapped_column(String(50))

    # ── Relationships ────────────────────────────────────────────
    occupancy_records: Mapped[list["TrainSectionOccupancy"]] = relationship(
        back_populates="train_run"
    )


class TrainSectionOccupancy(TimestampMixin, Base):
    """Track-level occupancy record for a train run through a section."""

    __tablename__ = "train_section_occupancy"

    occupancy_id: Mapped[str] = mapped_column(String(50), primary_key=True)
    run_id: Mapped[str | None] = mapped_column(
        String(50), ForeignKey("train_runs.run_id"), index=True
    )
    train_id: Mapped[str | None] = mapped_column(String(20), index=True)
    section_id: Mapped[str | None] = mapped_column(
        String(50), ForeignKey("sections.section_id"), index=True
    )
    track_id: Mapped[str | None] = mapped_column(String(50))
    direction: Mapped[str | None] = mapped_column(String(50))
    entry_time: Mapped[time | None] = mapped_column(Time)
    exit_time: Mapped[time | None] = mapped_column(Time)
    train_type: Mapped[str | None] = mapped_column(String(50))
    priority_rank: Mapped[int | None] = mapped_column(Integer)
    source_type: Mapped[str | None] = mapped_column(String(50))

    # ── Relationships ────────────────────────────────────────────
    train_run: Mapped["TrainRun | None"] = relationship(
        back_populates="occupancy_records"
    )
