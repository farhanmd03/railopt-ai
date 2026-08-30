"""Maintenance task schemas for serialization."""

from datetime import date
from pydantic import BaseModel, ConfigDict


class MaintenanceTaskResponse(BaseModel):
    """Schema representing a maintenance task / defect work order."""

    task_id: str
    asset_id: str | None = None
    section_id: str | None = None
    department: str
    defect_type: str | None = None
    severity: str | None = None
    reported_date: date | None = None
    days_overdue: int | None = None
    required_duration_hrs: float | None = None
    postpone_penalty_cost: float | None = None
    priority_score: float | None = None
    status: str | None = None
    source_type: str | None = None

    model_config = ConfigDict(from_attributes=True)


class MaintenanceTaskDetailResponse(MaintenanceTaskResponse):
    """Detailed schema representing a maintenance task."""

    pass
