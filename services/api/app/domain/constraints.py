"""Optimization hard constraints configuration.

=============================================================================
PURPOSE:
This module defines the explicit operational rules and feasibility bounds
enforced as hard constraints by the CP-SAT solver.

SAFETY & ASSUMPTION NOTES:
1. Railway Operating Constraints:
   - A single maintenance task can be scheduled AT MOST ONCE across the planning horizon.
   - Blocks with detected train occupancy conflicts cannot be scheduled when
     `allow_train_conflict` is False.
   - Blocks cannot exceed `max_block_duration_hrs`.
2. Prototype Dataset Assumptions:
   - Resource shift tables are currently UNVERIFIED in the prototype dataset.
     Therefore, `require_resource_feasibility` defaults to False for prototype
     execution, but can be enabled when live shift tables are provided.
=============================================================================
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class HardConstraintConfig:
    """Configurable parameters for solver hard constraints."""

    max_block_duration_hrs: float = 8.0
    """Maximum allowable continuous duration for any single maintenance block."""

    allow_train_conflict: bool = False
    """Hard rule: If False, candidate blocks with train occupancy conflicts are strictly pruned."""

    require_candidate_feasible: bool = True
    """Hard rule: Candidate block must have computed_feasibility_status == 'FEASIBLE'."""

    require_resource_feasibility: bool = False
    """Prototype rule: If False, unverified resource availability does not prevent scheduling."""

    max_tasks_per_block: int = 3
    """Maximum number of integrated tasks allowed per combined maintenance block."""

    enforce_single_assignment_per_task: bool = True
    """Hard rule: Each maintenance task is assigned to at most one scheduled block."""
