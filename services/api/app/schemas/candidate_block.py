"""Schemas for Candidate Block Generation (Batch 5C)."""

from __future__ import annotations

from datetime import date, datetime
from pydantic import BaseModel, ConfigDict, Field

DEFAULT_CANDIDATE_ADVISORY_NOTE = (
    "This is a computational candidate for planning evaluation. "
    "It is NOT an engineering, traffic-control, or safety approval."
)


class CandidateBlockResponse(BaseModel):
    """Schema representing a candidate maintenance block option."""

    candidate_id: str
    opportunity_id: str | None = None
    task_ids: list[str]
    departments_involved: list[str]
    section_id: str
    window_id: str
    candidate_start: datetime
    candidate_end: datetime
    required_duration_hrs: float
    window_duration_hrs: float
    source_window_status: str | None = None
    computed_feasibility_status: str  # FEASIBLE | TRAIN_CONFLICT | DURATION_INSUFFICIENT
    train_conflict: bool
    train_conflict_count: int
    freight_data_available: bool
    freight_level: str | None = None
    forecast_freight_trains: int | None = None
    forecast_tonnage: float | None = None
    freight_confidence: float | None = None
    resource_check: str  # VERIFIED | UNVERIFIED | UNAVAILABLE
    resources_available: bool
    resource_ids: list[str]
    priority_score: float
    compatibility_score: float
    candidate_score: float
    reasons: list[str]
    warnings: list[str]
    advisory_note: str = DEFAULT_CANDIDATE_ADVISORY_NOTE

    model_config = ConfigDict(from_attributes=True)


class CandidateBlocksListResponse(BaseModel):
    """Paginated list response for candidate blocks."""

    items: list[CandidateBlockResponse]
    total: int
    page: int
    page_size: int
    total_pages: int

    model_config = ConfigDict(from_attributes=True)
