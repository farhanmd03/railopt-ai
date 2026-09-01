"""Pydantic schemas for What-If Scenario Analysis (Batch 7K)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, Field, field_validator

from app.schemas.optimization import OptimizationRunResponse, OptimizedBlockResponse


class ScenarioCreateRequest(BaseModel):
    """Request payload to create and execute a What-If Scenario."""

    name: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Human-readable name for the scenario (e.g. 'High Train Disruption Sensitivity')",
    )
    scenario_type: str = Field(
        default="OBJECTIVE_WEIGHTS",
        description="Scenario category: OBJECTIVE_WEIGHTS | HORIZON | CANDIDATE_EXCLUSION",
    )
    planning_start: datetime | None = Field(
        default=None,
        description="Alternative planning horizon start timestamp",
    )
    planning_end: datetime | None = Field(
        default=None,
        description="Alternative planning horizon end timestamp",
    )

    @field_validator("planning_start", "planning_end", mode="after")
    @classmethod
    def ensure_utc_timestamps(cls, v: datetime | None) -> datetime | None:
        if v is not None and v.tzinfo is None:
            return v.replace(tzinfo=timezone.utc)
        return v
    solver_time_limit_seconds: float = Field(
        default=10.0,
        ge=1.0,
        le=60.0,
        description="Maximum solver wall-clock time limit",
    )

    # Soft objective weights override
    weight_priority_score: float | None = Field(
        default=None, ge=0.0, le=100.0, description="Weight for task priority scores"
    )
    weight_integrated_task_bonus: float | None = Field(
        default=None, ge=0.0, le=100.0, description="Bonus weight for cross-department integration"
    )
    weight_tasks_scheduled: float | None = Field(
        default=None, ge=0.0, le=100.0, description="Weight for maximizing scheduled task count"
    )
    weight_overdue_mitigation: float | None = Field(
        default=None, ge=0.0, le=100.0, description="Weight for overdue task mitigation urgency"
    )
    weight_train_disruption: float | None = Field(
        default=None, ge=0.0, le=100.0, description="Penalty weight for train traffic conflicts"
    )
    weight_freight_impact: float | None = Field(
        default=None, ge=0.0, le=100.0, description="Penalty weight for freight tonnage disruption"
    )
    weight_unused_window_time: float | None = Field(
        default=None, ge=0.0, le=100.0, description="Penalty weight for unused possession window slack"
    )
    weight_total_block_count: float | None = Field(
        default=None, ge=0.0, le=100.0, description="Penalty weight to discourage block fragmentation"
    )

    excluded_candidate_ids: list[str] = Field(
        default_factory=list,
        description="List of candidate block IDs to exclude from this scenario",
    )
    notes: str | None = Field(
        default=None,
        max_length=2000,
        description="Optional operational notes explaining the scenario hypothesis",
    )


class ScenarioMetricDelta(BaseModel):
    """Numeric comparison delta between original base run and scenario run."""

    original: float
    scenario: float
    delta: float


class ScenarioComparisonSummary(BaseModel):
    """High-level comparative metrics for base run vs scenario run."""

    tasks_scheduled: ScenarioMetricDelta
    tasks_unassigned: ScenarioMetricDelta
    block_count: ScenarioMetricDelta
    integrated_blocks: ScenarioMetricDelta
    estimated_total_block_hours: ScenarioMetricDelta
    objective_value: ScenarioMetricDelta
    explanation: str = Field(
        ...,
        description="Deterministic, data-grounded narrative explaining the differences",
    )


class ScenarioTaskImpact(BaseModel):
    """Detailed task assignment diff between base run and scenario."""

    retained_task_ids: list[str] = Field(default_factory=list)
    newly_unassigned_task_ids: list[str] = Field(default_factory=list)
    newly_scheduled_task_ids: list[str] = Field(default_factory=list)
    changed_block_task_ids: list[str] = Field(default_factory=list)


class ScenarioBlockSummary(BaseModel):
    """Detailed block differences between base run and scenario."""

    added_block_count: int = 0
    removed_block_count: int = 0
    retained_block_count: int = 0
    added_blocks: list[OptimizedBlockResponse] = Field(default_factory=list)
    removed_blocks: list[OptimizedBlockResponse] = Field(default_factory=list)
    retained_blocks: list[OptimizedBlockResponse] = Field(default_factory=list)


class OptimizationScenarioResponse(BaseModel):
    """Full representation of a What-If Scenario record with comparison against base run."""

    id: int
    scenario_id: str
    name: str
    scenario_type: str
    status: str
    base_run_id: int
    scenario_run_id: int | None = None
    created_by: str | None = None
    parameters: dict[str, Any] = Field(default_factory=dict)
    notes: str | None = None
    created_at: datetime | None = None
    base_run: OptimizationRunResponse | None = None
    scenario_run: OptimizationRunResponse | None = None
    comparison: ScenarioComparisonSummary | None = None
    task_impact: ScenarioTaskImpact | None = None
    block_differences: ScenarioBlockSummary | None = None


class OptimizationScenarioListResponse(BaseModel):
    """List response for scenarios associated with a base run."""

    items: list[OptimizationScenarioResponse]
    total: int
