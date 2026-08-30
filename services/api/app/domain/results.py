"""Optimization solver status and run result domain models.

=============================================================================
CONTROLLED STATUS DISTINCTION:
SolverStatus strictly represents the algorithmic termination state of the
CP-SAT mathematical solver (OPTIMAL, FEASIBLE, INFEASIBLE, UNKNOWN, NOT_SOLVED).
It must NOT be conflated with the railway business/operational approval status
(e.g., DRAFT, SUBMITTED, APPROVED, REJECTED), which is managed in a separate
workflow layer.
=============================================================================
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum


class SolverStatus(str, Enum):
    """Algorithmic status returned by the mathematical optimization solver."""

    OPTIMAL = "OPTIMAL"
    FEASIBLE = "FEASIBLE"
    INFEASIBLE = "INFEASIBLE"
    UNKNOWN = "UNKNOWN"
    NOT_SOLVED = "NOT_SOLVED"


@dataclass(frozen=True)
class OptimizedBlockDomain:
    """Domain representation of a scheduled maintenance block decided by the optimizer."""

    optimized_block_id: str
    section_id: str
    window_id: str
    start_time: datetime
    end_time: datetime
    duration_hrs: float
    candidate_id: str | None = None
    task_ids: list[str] = field(default_factory=list)
    departments_involved: list[str] = field(default_factory=list)
    is_integrated: bool = False
    train_conflict_count: int = 0
    freight_impact: str | None = None
    resource_status: str = "UNVERIFIED"
    priority_value: float = 0.0  # Candidate-stage priority score from Batch 5C
    realized_priority_value: float = 0.0  # Authentic summed task-priority value driving the CP-SAT objective decision
    compatibility_value: float = 100.0  # Multi-task integration compatibility score
    reasons: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class OptimizationRunResult:
    """Comprehensive domain result of an optimization run."""

    run_id: str
    planning_start: datetime
    planning_end: datetime
    solver_status: SolverStatus = SolverStatus.NOT_SOLVED
    objective_value: float | None = None
    scheduled_blocks: list[OptimizedBlockDomain] = field(default_factory=list)
    unassigned_tasks: list[str] = field(default_factory=list)
    tasks_considered: int = 0
    tasks_scheduled: int = 0
    tasks_unassigned: int = 0
    integrated_block_count: int = 0
    separate_block_count: int = 0
    estimated_total_block_hours: float = 0.0
    solver_runtime_seconds: float | None = None
    warnings: list[str] = field(default_factory=list)
