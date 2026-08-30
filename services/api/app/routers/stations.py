"""Stations API router."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.common import PaginatedResponse
from app.schemas.station import StationDetailResponse, StationResponse
from app.services.station_service import StationService

router = APIRouter(prefix="/stations", tags=["Stations"])


@router.get(
    "",
    response_model=PaginatedResponse[StationResponse],
    summary="List stations",
    description="Retrieve a paginated list of railway stations with optional section filter.",
)
async def list_stations(
    section_id: str | None = Query(None, description="Filter stations belonging to a specific section"),
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page (max 100)"),
    db: AsyncSession = Depends(get_db),
) -> PaginatedResponse[StationResponse]:
    """List stations with pagination and optional section filter."""
    items, total = await StationService.get_stations(
        db=db,
        section_id=section_id,
        page=page,
        page_size=page_size,
    )
    return PaginatedResponse.create(
        items=[StationResponse.model_validate(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/{station_code}",
    response_model=StationDetailResponse,
    summary="Get station details",
    description="Retrieve detailed attributes of a specific railway station by its station code.",
    responses={404: {"description": "Station not found"}},
)
async def get_station(
    station_code: str,
    db: AsyncSession = Depends(get_db),
) -> StationDetailResponse:
    """Get station details by station code."""
    station = await StationService.get_station_by_code(db=db, station_code=station_code.upper())
    if not station:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Station with code '{station_code.upper()}' not found",
        )
    return StationDetailResponse.model_validate(station)
