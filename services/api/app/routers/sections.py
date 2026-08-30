"""Sections API router."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.common import PaginatedResponse
from app.schemas.section import SectionDetailResponse, SectionResponse
from app.services.section_service import SectionService

router = APIRouter(prefix="/sections", tags=["Sections"])


@router.get(
    "",
    response_model=PaginatedResponse[SectionResponse],
    summary="List operational sections",
    description="Retrieve a paginated list of operational sections with optional division filtering.",
)
async def list_sections(
    division_id: int | None = Query(None, description="Filter by division ID"),
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page (max 100)"),
    db: AsyncSession = Depends(get_db),
) -> PaginatedResponse[SectionResponse]:
    """List sections with pagination and optional division filter."""
    items, total = await SectionService.get_sections(
        db=db,
        division_id=division_id,
        page=page,
        page_size=page_size,
    )
    return PaginatedResponse.create(
        items=[SectionResponse.model_validate(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/{section_id}",
    response_model=SectionDetailResponse,
    summary="Get section details",
    description="Retrieve detailed attributes of a specific section by its business identifier.",
    responses={404: {"description": "Section not found"}},
)
async def get_section(
    section_id: str,
    db: AsyncSession = Depends(get_db),
) -> SectionDetailResponse:
    """Get section details by section ID."""
    section = await SectionService.get_section_by_id(db=db, section_id=section_id)
    if not section:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Section with ID '{section_id}' not found",
        )
    return SectionDetailResponse.model_validate(section)
