"""Station schemas for serialization."""

from pydantic import BaseModel, ConfigDict


class StationResponse(BaseModel):
    """Schema representing a railway station."""

    station_code: str
    station_name: str
    station_type: str | None = None
    block_station: bool | None = None
    ibp: bool | None = None
    flag_station: bool | None = None
    halt: bool | None = None
    platform_available: bool | None = None
    latitude: float | None = None
    longitude: float | None = None
    division: str | None = None
    zone: str | None = None

    model_config = ConfigDict(from_attributes=True)


class StationDetailResponse(StationResponse):
    """Detailed schema representing a station with administrative metadata."""

    out_of_division_station: bool | None = None
    administrative_division: str | None = None
    scope_note: str | None = None
    source_type: str | None = None
