"""Domain models for deterministic maintenance priority calculation.

This module is part of the core domain layer and MUST NOT import
FastAPI, SQLAlchemy ORM, or HTTP response schemas.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class PriorityComponents:
    """Normalized components contributing to priority score (each 0.0 - 100.0)."""

    severity_component: float
    overdue_component: float
    criticality_component: float
    failure_risk_component: float


@dataclass(frozen=True)
class PriorityCalculationResult:
    """Domain-level calculation result for maintenance priority assessment."""

    task_id: str
    asset_id: str | None
    section_id: str | None
    department: str
    computed_priority_score: float
    baseline_priority_score: float | None
    priority_band: str  # CRITICAL | HIGH | MEDIUM | LOW
    components: PriorityComponents
    reasons: list[str] = field(default_factory=list)
