"""Asset schemas for serialization."""

from datetime import date
from pydantic import BaseModel, ConfigDict


class AssetResponse(BaseModel):
    """Schema representing a fixed infrastructure asset."""

    asset_id: str
    section_id: str | None = None
    station_code: str | None = None
    department: str
    asset_type: str
    failure_risk_score: float | None = None
    criticality_index: float | None = None
    last_maintained_date: date | None = None
    source_type: str | None = None

    model_config = ConfigDict(from_attributes=True)


class AssetDetailResponse(AssetResponse):
    """Detailed schema representing an asset."""

    pass
