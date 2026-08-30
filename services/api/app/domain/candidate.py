"""Domain representation for an optimization candidate block.

This model is part of the pure domain layer and does NOT import ORM models or FastAPI.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime


@dataclass(frozen=True)
class OptimizationCandidate:
    """Domain representation of a candidate maintenance block option for the optimizer."""

    candidate_id: str
    section_id: str
    window_id: str
    candidate_start: datetime
    candidate_end: datetime
    required_duration_hrs: float
    window_duration_hrs: float
    task_ids: list[str] = field(default_factory=list)
    departments_involved: list[str] = field(default_factory=list)
    opportunity_id: str | None = None
    priority_score: float = 0.0
    compatibility_score: float = 100.0
    candidate_score: float = 0.0
    train_conflict: bool = False
    train_conflict_count: int = 0
    freight_data_available: bool = False
    freight_level: str | None = None
    forecast_freight_trains: int | None = None
    forecast_tonnage: float | None = None
    resource_check: str = "UNVERIFIED"
    resource_ids: list[str] = field(default_factory=list)
    source_window_status: str | None = None
    computed_feasibility_status: str = "FEASIBLE"
    warnings: list[str] = field(default_factory=list)
    reasons: list[str] = field(default_factory=list)
