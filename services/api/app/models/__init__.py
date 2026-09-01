"""SQLAlchemy models package.

All models are imported here so that Alembic's ``target_metadata``
(``Base.metadata``) discovers every table for autogenerate.
"""

from app.models.base import Base, TimestampMixin  # noqa: F401

from app.models.geography import (  # noqa: F401
    Division,
    OperationalSubsection,
    Section,
    SectionStationMap,
    Station,
)
from app.models.asset import Asset, MaintenanceTask  # noqa: F401
from app.models.operations import TrainRun, TrainSectionOccupancy  # noqa: F401
from app.models.corridor import CorridorWindow, FreightForecast  # noqa: F401
from app.models.resource import Resource, ResourceAvailability  # noqa: F401
from app.models.block import BlockRequest, BlockRequestTask  # noqa: F401
from app.models.optimization import (  # noqa: F401
    OptimizationRun,
    OptimizedBlock,
    OptimizedBlockTask,
)
from app.models.admin import AuditLog, SystemSetting  # noqa: F401

__all__ = [
    "Base",
    "TimestampMixin",
    # Geography
    "Division",
    "Section",
    "Station",
    "SectionStationMap",
    "OperationalSubsection",
    # Assets
    "Asset",
    "MaintenanceTask",
    # Operations
    "TrainRun",
    "TrainSectionOccupancy",
    # Corridor
    "CorridorWindow",
    "FreightForecast",
    # Resources
    "Resource",
    "ResourceAvailability",
    # Block planning
    "BlockRequest",
    "BlockRequestTask",
    # Optimization
    "OptimizationRun",
    "OptimizedBlock",
    "OptimizedBlockTask",
    # Admin
    "AuditLog",
    "SystemSetting",
]
