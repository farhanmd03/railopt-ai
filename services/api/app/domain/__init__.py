"""RailOpt AI Domain Layer Package.

Contains pure domain models, calculation results, optimization representations,
objective weights, hard constraints, and solver result definitions.
"""

from app.domain.candidate import OptimizationCandidate
from app.domain.constraints import HardConstraintConfig
from app.domain.corridor import CorridorWindowDomain
from app.domain.objectives import ObjectiveWeights
from app.domain.occupancy import TrainOccupancyDomain
from app.domain.priority import (
    PriorityCalculationResult,
    PriorityComponents,
)
from app.domain.resource import ResourceDomain
from app.domain.results import (
    OptimizationRunResult,
    OptimizedBlockDomain,
    SolverStatus,
)
from app.domain.task import OptimizationTask

__all__ = [
    # Priority
    "PriorityCalculationResult",
    "PriorityComponents",
    # Optimization inputs
    "OptimizationTask",
    "CorridorWindowDomain",
    "TrainOccupancyDomain",
    "ResourceDomain",
    "OptimizationCandidate",
    # Optimization config
    "ObjectiveWeights",
    "HardConstraintConfig",
    # Optimization outputs
    "SolverStatus",
    "OptimizedBlockDomain",
    "OptimizationRunResult",
]
