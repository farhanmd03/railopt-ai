"""Assets API router."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.asset import AssetDetailResponse, AssetResponse
from app.schemas.common import PaginatedResponse
from app.services.asset_service import AssetService

router = APIRouter(prefix="/assets", tags=["Assets"])


@router.get(
    "",
    response_model=PaginatedResponse[AssetResponse],
    summary="List assets",
    description="Retrieve a paginated list of railway assets with optional department, asset_type, and section filters.",
)
async def list_assets(
    department: str | None = Query(None, description="Filter by department (Engineering, S&T, TRD)"),
    asset_type: str | None = Query(None, description="Filter by asset type (Track, Signal, OHE)"),
    section_id: str | None = Query(None, description="Filter by section ID"),
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page (max 100)"),
    db: AsyncSession = Depends(get_db),
) -> PaginatedResponse[AssetResponse]:
    """List assets with pagination and filters."""
    items, total = await AssetService.get_assets(
        db=db,
        department=department,
        asset_type=asset_type,
        section_id=section_id,
        page=page,
        page_size=page_size,
    )
    return PaginatedResponse.create(
        items=[AssetResponse.model_validate(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/{asset_id}",
    response_model=AssetDetailResponse,
    summary="Get asset details",
    description="Retrieve detailed attributes of a specific asset by its identifier.",
    responses={404: {"description": "Asset not found"}},
)
async def get_asset(
    asset_id: str,
    db: AsyncSession = Depends(get_db),
) -> AssetDetailResponse:
    """Get asset details by asset ID."""
    asset = await AssetService.get_asset_by_id(db=db, asset_id=asset_id)
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Asset with ID '{asset_id}' not found",
        )
    return AssetDetailResponse.model_validate(asset)
