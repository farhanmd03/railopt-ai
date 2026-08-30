"""Domain representation for a maintenance task in optimization.

This model is part of the pure domain layer and does NOT import ORM models or FastAPI.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date


@dataclass(frozen=True)
class OptimizationTask:
    """Compact domain task representation for optimizer consumption."""

    task_id: str
    section_id: str
    department: str
    duration_hrs: float
    priority_score: float
    days_overdue: int | None = None
    asset_id: str | None = None
    deadline: date | None = None
    severity: str | None = None
