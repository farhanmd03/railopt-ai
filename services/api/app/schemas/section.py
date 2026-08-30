"""Section schemas for serialization."""

from pydantic import BaseModel, ConfigDict


class SectionResponse(BaseModel):
    """Schema representing an operational section."""

    section_id: str
    section_name: str
    from_station_code: str | None = None
    to_station_code: str | None = None
    route_km: float | None = None
    track_count: int | None = None
    line_type: str | None = None
    electrified: bool | None = None
    signalling_system: str | None = None
    division_id: int | None = None
    source_type: str | None = None

    model_config = ConfigDict(from_attributes=True)


class SectionDetailResponse(SectionResponse):
    """Detailed schema representing a section with provenance."""

    source: str | None = None
