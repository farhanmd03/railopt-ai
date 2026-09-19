"""Pydantic schemas for What-If Scenario Analysis and Counterfactual Planning (Badge 3)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.optimization import OptimizationRunResponse, OptimizedBlockResponse
from app.schemas.readiness import PossessionReadinessResponse, ReadinessCheck


class CounterfactualBlockData(BaseModel):
    """Detailed block data representation for baseline and alternative comparison."""

    model_config = ConfigDict(from_attributes=True)

    block_id: int | None = None
    optimized_block_id: str | None = None
    section_id: str
    block_start: datetime
    block_end: datetime
    duration_hrs: float
    is_integrated: bool = False
    departments: list[str] = Field(default_factory=list)
    task_ids: list[str] = Field(default_factory=list)
    priority_score: float = 0.0
    train_conflicts: int = 0
    conflict_trains: list[str] = Field(default_factory=list)
    estimated_impact_score: float = 0.0
    readiness: PossessionReadinessResponse | None = None


class CounterfactualComparison(BaseModel):
    """Structured before/after comparison between baseline block and proposed alternative."""

    target_block_id: int
    scenario_type: str
    rating: str = Field(..., description="'BETTER' | 'WORSE' | 'NEUTRAL'")
    explanation: str = Field(
        ...,
        description="Clear narrative answering 'What changes if we postpone/reduce/move this block?'",
    )
    baseline: CounterfactualBlockData
    alternative: CounterfactualBlockData
    deltas: dict[str, Any] = Field(
        default_factory=dict,
        description="Numerical deltas and item changes (duration, priority, train conflicts, tasks, readiness)",
    )


class BlockCounterfactualRequest(BaseModel):
    """Direct request to evaluate a counterfactual alternative for a specific block."""

    scenario_type: str = Field(
        ...,
        description="POSTPONE | REDUCE_DURATION | MOVE_WINDOW | CHANGE_TASKS_DEPT",
    )
    postpone_hours: float | None = Field(
        default=None,
        gt=0.0,
        description="Hours to postpone the block (for POSTPONE)",
    )
    new_start: datetime | None = Field(
        default=None,
        description="Alternative block start timestamp (for POSTPONE or MOVE_WINDOW)",
    )
    new_end: datetime | None = Field(
        default=None,
        description="Alternative block end timestamp (for POSTPONE or MOVE_WINDOW)",
    )
    new_duration_hrs: float | None = Field(
        default=None,
        gt=0.0,
        description="Target duration in hours (for REDUCE_DURATION)",
    )
    new_task_ids: list[str] | None = Field(
        default=None,
        description="Replacement task ID set (for CHANGE_TASKS_DEPT)",
    )
    new_departments: list[str] | None = Field(
        default=None,
        description="Replacement departments list (for CHANGE_TASKS_DEPT)",
    )
    notes: str | None = Field(
        default=None,
        max_length=1000,
        description="Optional planner notes on this counterfactual exploration",
    )

    @field_validator("new_start", "new_end", mode="after")
    @classmethod
    def ensure_utc_timestamps(cls, v: datetime | None) -> datetime | None:
        if v is not None and v.tzinfo is None:
            return v.replace(tzinfo=timezone.utc)
        return v

    @model_validator(mode="after")
    def validate_block_counterfactual(self) -> BlockCounterfactualRequest:
        st = (self.scenario_type or "").upper()
        if st in ("POSTPONE", "POSTPONE_BLOCK"):
            if self.postpone_hours is None and self.new_start is None:
                raise ValueError("POSTPONE scenario requires either postpone_hours or new_start")
            if self.new_start and self.new_end and self.new_start >= self.new_end:
                raise ValueError("new_start must be strictly before new_end")
        elif st in ("REDUCE_DURATION", "REDUCE"):
            if self.new_duration_hrs is None or self.new_duration_hrs <= 0:
                raise ValueError("REDUCE_DURATION requires positive new_duration_hrs")
        elif st in ("MOVE_WINDOW", "MOVE"):
            if self.new_start is None or self.new_end is None:
                raise ValueError("MOVE_WINDOW requires both new_start and new_end")
            if self.new_start >= self.new_end:
                raise ValueError("new_start must be strictly before new_end")
        elif st in ("CHANGE_TASKS_DEPT", "CHANGE_TASKS"):
            if self.new_task_ids is None and self.new_departments is None:
                raise ValueError("CHANGE_TASKS_DEPT requires at least new_task_ids or new_departments")
        return self


class ScenarioCreateRequest(BaseModel):
    """Request payload to create and execute a What-If Scenario."""

    name: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Human-readable name for the scenario (e.g. 'Postpone Block 0001 by 2h')",
    )
    scenario_type: str = Field(
        default="OBJECTIVE_WEIGHTS",
        description="Scenario category: OBJECTIVE_WEIGHTS | HORIZON | CANDIDATE_EXCLUSION | POSTPONE | REDUCE_DURATION | MOVE_WINDOW | CHANGE_TASKS_DEPT",
    )
    planning_start: datetime | None = Field(
        default=None,
        description="Alternative planning horizon start timestamp",
    )
    planning_end: datetime | None = Field(
        default=None,
        description="Alternative planning horizon end timestamp",
    )
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

    # Counterfactual block-level scenario fields
    target_block_id: int | None = Field(
        default=None,
        description="Target OptimizedBlock ID to adjust for block counterfactual scenarios",
    )
    postpone_hours: float | None = Field(
        default=None,
        gt=0.0,
        description="Hours to shift block start and end forward",
    )
    new_start: datetime | None = Field(
        default=None,
        description="New start timestamp for target block",
    )
    new_end: datetime | None = Field(
        default=None,
        description="New end timestamp for target block",
    )
    new_duration_hrs: float | None = Field(
        default=None,
        gt=0.0,
        description="New duration in hours for target block",
    )
    new_task_ids: list[str] = Field(
        default_factory=list,
        description="Replacement task ID set for target block",
    )
    new_departments: list[str] = Field(
        default_factory=list,
        description="Replacement departments list for target block",
    )
    notes: str | None = Field(
        default=None,
        max_length=2000,
        description="Optional operational notes explaining the scenario hypothesis",
    )

    @field_validator("planning_start", "planning_end", "new_start", "new_end", mode="after")
    @classmethod
    def ensure_utc_timestamps(cls, v: datetime | None) -> datetime | None:
        if v is not None and v.tzinfo is None:
            return v.replace(tzinfo=timezone.utc)
        return v

    @model_validator(mode="after")
    def validate_scenario_type_payload(self) -> ScenarioCreateRequest:
        st = (self.scenario_type or "").upper()
        if st in ("POSTPONE", "POSTPONE_BLOCK"):
            if self.target_block_id is None:
                raise ValueError("POSTPONE scenario requires target_block_id")
            if self.postpone_hours is None and self.new_start is None:
                raise ValueError("POSTPONE scenario requires either postpone_hours or new_start")
            if self.new_start and self.new_end and self.new_start >= self.new_end:
                raise ValueError("new_start must be strictly before new_end")
        elif st in ("REDUCE_DURATION", "REDUCE"):
            if self.target_block_id is None:
                raise ValueError("REDUCE_DURATION requires target_block_id")
            if self.new_duration_hrs is None or self.new_duration_hrs <= 0:
                raise ValueError("REDUCE_DURATION requires positive new_duration_hrs")
        elif st in ("MOVE_WINDOW", "MOVE"):
            if self.target_block_id is None:
                raise ValueError("MOVE_WINDOW requires target_block_id")
            if self.new_start is None or self.new_end is None:
                raise ValueError("MOVE_WINDOW requires both new_start and new_end")
            if self.new_start >= self.new_end:
                raise ValueError("new_start must be strictly before new_end")
        elif st in ("CHANGE_TASKS_DEPT", "CHANGE_TASKS"):
            if self.target_block_id is None:
                raise ValueError("CHANGE_TASKS_DEPT requires target_block_id")
            if not self.new_task_ids and not self.new_departments:
                raise ValueError("CHANGE_TASKS_DEPT requires at least new_task_ids or new_departments")
        return self


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
    counterfactual_comparison: CounterfactualComparison | None = None


class OptimizationScenarioListResponse(BaseModel):
    """List response for scenarios associated with a base run."""

    items: list[OptimizationScenarioResponse]
    total: int
