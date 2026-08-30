"""Schemas for Maintenance Task Compatibility and Integrated Block Opportunities."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

DEFAULT_ADVISORY_NOTE = (
    "This is a deterministic candidate-screening signal based on "
    "section co-location, department mix, estimated duration, and "
    "task status. It is NOT a validated engineering or safety "
    "approval. Actual execution requires human engineering review "
    "and further scheduling validation."
)


class PrioritySummary(BaseModel):
    """Aggregated priority metrics for tasks in an integration opportunity."""

    highest_task_priority: float
    average_task_priority: float
    total_priority_value: float

    model_config = ConfigDict(from_attributes=True)


class IntegrationOpportunityResponse(BaseModel):
    """Schema representing an opportunity to integrate multiple maintenance tasks."""

    opportunity_id: str
    section_id: str
    task_ids: list[str]
    departments_involved: list[str]
    is_cross_department: bool
    compatibility_status: str  # COMPATIBLE | PARTIALLY_COMPATIBLE | INCOMPATIBLE
    compatibility_score: float
    combined_duration_hrs: float
    priority_summary: PrioritySummary
    compatibility_reasons: list[str]
    spatial_compatibility: str
    temporal_compatibility: str
    duration_compatibility: str
    resource_compatibility: str
    advisory_note: str = DEFAULT_ADVISORY_NOTE

    model_config = ConfigDict(from_attributes=True)


class IntegrationOpportunitiesListResponse(BaseModel):
    """Paginated list response for integration opportunities."""

    items: list[IntegrationOpportunityResponse]
    total: int
    page: int
    page_size: int
    total_pages: int

    model_config = ConfigDict(from_attributes=True)
