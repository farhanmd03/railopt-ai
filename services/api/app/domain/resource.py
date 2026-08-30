"""Domain representation for maintenance resource availability and capacity.

This model is part of the pure domain layer and does NOT import ORM models or FastAPI.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import time


@dataclass(frozen=True)
class ResourceDomain:
    """Compact domain resource representation for optimizer capacity evaluation."""

    resource_id: str
    department: str
    depot: str | None = None
    availability_from: time | None = None
    availability_to: time | None = None
    status: str | None = "Available"
    capacity_units: int = 1
