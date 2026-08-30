"""Domain representation for a corridor window in optimization.

This model is part of the pure domain layer and does NOT import ORM models or FastAPI.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class CorridorWindowDomain:
    """Compact domain corridor window representation for optimizer consumption."""

    window_id: str
    section_id: str
    window_start: datetime
    window_end: datetime
    duration_hrs: float
    source_status: str | None = None
    computed_feasibility_status: str | None = None
