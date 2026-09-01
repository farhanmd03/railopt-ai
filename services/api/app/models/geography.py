"""Geography models: Division, Section, Station, SectionStationMap, OperationalSubsection.

Station ↔ Section is a many-to-many relationship through SectionStationMap.
A station may belong to multiple sections.
Section has from/to station FKs representing its terminal stations.
"""

from sqlalchemy import (
    Boolean,
    Float,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Division(TimestampMixin, Base):
    """Railway division (e.g., Howrah Division of Eastern Railway)."""

    __tablename__ = "divisions"

    id: Mapped[int] = mapped_column(primary_key=True)
    division_name: Mapped[str] = mapped_column(
        String(100), unique=True, nullable=False
    )
    zone: Mapped[str] = mapped_column(String(100), nullable=False)
    total_route_km: Mapped[float | None] = mapped_column(Numeric(10, 2))
    total_stations: Mapped[int | None] = mapped_column(Integer)
    total_block_stations: Mapped[int | None] = mapped_column(Integer)
    source: Mapped[str | None] = mapped_column(String(200))
    source_type: Mapped[str | None] = mapped_column(String(50))

    # ── Relationships ────────────────────────────────────────────
    sections: Mapped[list["Section"]] = relationship(back_populates="division_rel")


class Station(TimestampMixin, Base):
    """Railway station within Howrah Division.

    Geographic coordinates stored as plain lat/lon floats.
    PostGIS geometry columns can be added later if spatial queries are needed.
    """

    __tablename__ = "stations"

    station_code: Mapped[str] = mapped_column(String(20), primary_key=True)
    station_name: Mapped[str] = mapped_column(String(200), nullable=False)
    station_type: Mapped[str | None] = mapped_column(String(50))
    block_station: Mapped[bool | None] = mapped_column(Boolean)
    ibp: Mapped[bool | None] = mapped_column(Boolean)
    flag_station: Mapped[bool | None] = mapped_column(Boolean)
    halt: Mapped[bool | None] = mapped_column(Boolean)
    platform_available: Mapped[bool | None] = mapped_column(Boolean)
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    division: Mapped[str | None] = mapped_column(String(100))
    zone: Mapped[str | None] = mapped_column(String(100))
    out_of_division_station: Mapped[bool | None] = mapped_column(
        Boolean, default=False
    )
    administrative_division: Mapped[str | None] = mapped_column(String(100))
    scope_note: Mapped[str | None] = mapped_column(Text)
    source_type: Mapped[str | None] = mapped_column(String(50))

    # ── Relationships ────────────────────────────────────────────
    section_mappings: Mapped[list["SectionStationMap"]] = relationship(
        back_populates="station"
    )

    __table_args__ = (Index("ix_stations_division", "division"),)


class Section(TimestampMixin, Base):
    """Operational section (e.g., Howrah–Dankuni).

    ``from_station_code`` / ``to_station_code`` are the terminal stations
    of the section — distinct from the many-to-many station memberships
    captured in ``SectionStationMap``.
    """

    __tablename__ = "sections"

    section_id: Mapped[str] = mapped_column(String(50), primary_key=True)
    section_name: Mapped[str] = mapped_column(String(200), nullable=False)
    from_station_code: Mapped[str | None] = mapped_column(
        String(20), ForeignKey("stations.station_code")
    )
    to_station_code: Mapped[str | None] = mapped_column(
        String(20), ForeignKey("stations.station_code")
    )
    route_km: Mapped[float | None] = mapped_column(Numeric(10, 2))
    track_count: Mapped[int | None] = mapped_column(Integer)
    line_type: Mapped[str | None] = mapped_column(String(50))
    electrified: Mapped[bool | None] = mapped_column(Boolean)
    signalling_system: Mapped[str | None] = mapped_column(String(100))
    division_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("divisions.id")
    )
    source: Mapped[str | None] = mapped_column(String(200))
    source_type: Mapped[str | None] = mapped_column(String(50))

    # ── Relationships ────────────────────────────────────────────
    division_rel: Mapped["Division | None"] = relationship(
        back_populates="sections"
    )
    from_station: Mapped["Station | None"] = relationship(
        foreign_keys=[from_station_code]
    )
    to_station: Mapped["Station | None"] = relationship(
        foreign_keys=[to_station_code]
    )
    station_mappings: Mapped[list["SectionStationMap"]] = relationship(
        back_populates="section"
    )
    subsections: Mapped[list["OperationalSubsection"]] = relationship(
        back_populates="section"
    )


class SectionStationMap(TimestampMixin, Base):
    """Many-to-many mapping between sections and stations.

    Captures the ordered list of stations within a section, together with
    the kilometre offset from the section start.
    """

    __tablename__ = "section_station_map"

    id: Mapped[int] = mapped_column(primary_key=True)
    section_id: Mapped[str] = mapped_column(
        String(50), ForeignKey("sections.section_id"), nullable=False
    )
    station_code: Mapped[str] = mapped_column(
        String(20), ForeignKey("stations.station_code"), nullable=False
    )
    station_sequence: Mapped[int | None] = mapped_column(Integer)
    km_from_section_start: Mapped[float | None] = mapped_column(Numeric(10, 2))
    relationship_type: Mapped[str | None] = mapped_column(String(200))

    # ── Relationships ────────────────────────────────────────────
    section: Mapped["Section"] = relationship(back_populates="station_mappings")
    station: Mapped["Station"] = relationship(back_populates="section_mappings")

    __table_args__ = (
        UniqueConstraint(
            "section_id", "station_code", name="uq_section_station"
        ),
        Index("ix_section_station_map_section", "section_id"),
        Index("ix_section_station_map_station", "station_code"),
    )


class OperationalSubsection(TimestampMixin, Base):
    """Subsection within a section for finer-grained block planning.

    Placeholder entity — the frozen dataset does not contain subsection
    data, but the schema is reserved for future use.
    """

    __tablename__ = "operational_subsections"

    id: Mapped[int] = mapped_column(primary_key=True)
    section_id: Mapped[str] = mapped_column(
        String(50), ForeignKey("sections.section_id"), nullable=False, index=True
    )
    subsection_name: Mapped[str] = mapped_column(String(200), nullable=False)
    from_km: Mapped[float | None] = mapped_column(Numeric(10, 2))
    to_km: Mapped[float | None] = mapped_column(Numeric(10, 2))
    description: Mapped[str | None] = mapped_column(Text)

    # ── Relationships ────────────────────────────────────────────
    section: Mapped["Section"] = relationship(back_populates="subsections")
