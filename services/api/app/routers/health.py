"""Health-check endpoints.

GET /health     — basic service liveness (no DB dependency)
GET /health/db  — database connectivity + PostGIS verification
"""

import logging

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.health import DatabaseHealthResponse, HealthResponse

logger = logging.getLogger(__name__)

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Basic service liveness check — always returns quickly."""
    return HealthResponse(status="ok", service="railopt-api")


@router.get("/health/db", response_model=DatabaseHealthResponse)
async def db_health_check(
    db: AsyncSession = Depends(get_db),
) -> DatabaseHealthResponse:
    """Database connectivity and PostGIS extension health check."""
    try:
        # Basic connectivity
        result = await db.execute(text("SELECT 1"))
        result.scalar_one()

        # PostGIS extension check
        postgis_result = await db.execute(text("SELECT PostGIS_Version()"))
        postgis_version = postgis_result.scalar_one_or_none()

        return DatabaseHealthResponse(
            status="ok",
            service="railopt-api",
            database="connected",
            postgis=postgis_version,
        )
    except Exception as exc:
        logger.error("Database health check failed: %s", exc, exc_info=True)
        return DatabaseHealthResponse(
            status="error",
            service="railopt-api",
            database="unreachable",
            postgis=None,
        )
