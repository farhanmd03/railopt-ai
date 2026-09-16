"""Possession Outcome Ledger API schemas (Badge 4)."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class PossessionOutcomeCreateRequest(BaseModel):
    """Request payload to create a possession outcome ledger entry."""

    planned_start: datetime = Field(..., description="Planned possession start time (UTC)")
    planned_end: datetime = Field(..., description="Planned possession end time (UTC)")
    actual_start: datetime | None = Field(None, description="Actual possession start time")
    actual_end: datetime | None = Field(None, description="Actual possession end time")
    status: str = Field(
        default="PLANNED",
        description="Status: PLANNED | IN_PROGRESS | COMPLETED | CANCELLED | DELAYED",
    )
    delay_minutes: int | None = Field(None, description="Delay in minutes if applicable")
    cancellation_reason: str | None = Field(None, description="Reason for cancellation")
    affected_departments: list[str] | None = Field(
        None, description="List of affected department names"
    )
    planned_impact_score: float | None = Field(None, description="Planned operational impact score")
    actual_impact_score: float | None = Field(None, description="Actual operational impact score")
    notes: str | None = Field(None, description="Free-text notes")


class PossessionOutcomeUpdateRequest(BaseModel):
    """Partial update payload for a possession outcome."""

    actual_start: datetime | None = None
    actual_end: datetime | None = None
    status: str | None = None
    delay_minutes: int | None = None
    cancellation_reason: str | None = None
    actual_impact_score: float | None = None
    notes: str | None = None


class PossessionOutcomeResponse(BaseModel):
    """Response model for a possession outcome ledger entry."""

    model_config = ConfigDict(from_attributes=True)

    id: int = Field(..., description="Database ID")
    optimized_block_id: int = Field(..., description="ID of the associated optimized block")
    planned_start: datetime = Field(..., description="Planned possession start time")
    planned_end: datetime = Field(..., description="Planned possession end time")
    actual_start: datetime | None = Field(None, description="Actual start time")
    actual_end: datetime | None = Field(None, description="Actual end time")
    status: str = Field(..., description="Current status")
    delay_minutes: int | None = Field(None, description="Delay in minutes")
    cancellation_reason: str | None = Field(None, description="Cancellation reason")
    affected_departments: list[str] | None = Field(None, description="Affected departments")
    planned_impact_score: float | None = Field(None, description="Planned impact")
    actual_impact_score: float | None = Field(None, description="Actual impact")
    notes: str | None = Field(None, description="Notes")
    recorded_by: str | None = Field(None, description="Username of recorder")
    created_at: datetime | None = Field(None, description="Creation timestamp")
    updated_at: datetime | None = Field(None, description="Last update timestamp")
