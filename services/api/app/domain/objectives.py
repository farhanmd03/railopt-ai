"""Optimization objective weights configuration.

=============================================================================
PURPOSE:
This module establishes configurable, named objective weights for the global
OR-Tools CP-SAT optimizer (Batch 6B).

OBJECTIVE DIRECTIONS:
- MAXIMIZE Objectives:
    * Total priority score scheduled
    * Integrated multi-department synergy / bonus
    * Total number of maintenance tasks cleared
    * Overdue maintenance backlog reduction

- MINIMIZE Objectives:
    * Train timetable disruption / passenger impact
    * High-traffic freight window conflicts
    * Unused idle window buffer waste
    * Number of separate fragmented maintenance blocks
=============================================================================
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ObjectiveWeights:
    """Configurable weights for the multi-objective optimization function."""

    # ── MAXIMIZE Objectives (Positive Value Contribution) ─────────────────
    weight_priority_score: float = 1.0
    """Weight for maximizing the cumulative priority score of scheduled tasks."""

    weight_integrated_task_bonus: float = 0.5
    """Weight for maximizing multi-department co-location synergy."""

    weight_tasks_scheduled: float = 0.8
    """Weight for maximizing the total number of distinct maintenance tasks completed."""

    weight_overdue_mitigation: float = 0.6
    """Weight for prioritizing the resolution of overdue backlog tasks."""

    # ── MINIMIZE Objectives (Penalty / Cost Contribution) ─────────────────
    weight_train_disruption: float = 2.0
    """Weight for penalizing scheduled blocks that disrupt scheduled train runs."""

    weight_freight_impact: float = 1.0
    """Weight for penalizing blocks during high-tonnage freight forecast intervals."""

    weight_unused_window_time: float = 0.2
    """Weight for penalizing excessive idle buffer time inside assigned windows."""

    weight_total_block_count: float = 0.3
    """Weight for penalizing schedule fragmentation across multiple isolated blocks."""

    def __post_init__(self) -> None:
        """Validate that all weights are non-negative."""
        for field_name, value in self.__dict__.items():
            if isinstance(value, (int, float)) and value < 0:
                raise ValueError(f"Objective weight '{field_name}' must be non-negative, got {value}")
