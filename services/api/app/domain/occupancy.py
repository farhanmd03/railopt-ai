"""Domain representation for train section occupancy / timetable passage in optimization.

This model is part of the pure domain layer and does NOT import ORM models or FastAPI.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import time


@dataclass(frozen=True)
class TrainOccupancyDomain:
    """Compact domain train passage / occupancy representation for optimizer constraint checking."""

    occupancy_id: str
    train_id: str
    section_id: str
    entry_time: time
    exit_time: time
    train_type: str | None = None
    priority_rank: int | None = None
