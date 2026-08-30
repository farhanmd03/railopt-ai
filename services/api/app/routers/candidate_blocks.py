"""Candidate blocks API router with RBAC role authorization (Batch 5C)."""

from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import User, require_roles
from app.schemas.candidate_block import (
    CandidateBlockResponse,
    CandidateBlocksListResponse,
)
from app.services.candidate_block_engine import CandidateBlockEngine

router = APIRouter(prefix="/candidate-blocks", tags=["Candidate Blocks"])

# Authorized roles for viewing candidate maintenance blocks
CANDIDATE_READ_ROLES = (
    "ADMIN",
    "PLANNER",
    "ENGINEERING",
    "SNT",
    "TRD",
    "CONTROL",
    "APPROVER",
    "VIEWER",
)


@router.get(
    "",
    response_model=CandidateBlocksListResponse,
    summary="List candidate maintenance blocks (RBAC Protected)",
    description=(
        "Retrieve a paginated list of candidate maintenance blocks evaluated against "
        "corridor windows, train section occupancy, freight forecasts, and resources. "
        "These are computational options for planning and NOT validated safety approvals. "
        "Requires authentication and one of: ADMIN, PLANNER, ENGINEERING, SNT, TRD, CONTROL, APPROVER, VIEWER."
    ),
    responses={
        401: {"description": "Missing, invalid, or expired authentication token"},
        403: {"description": "Insufficient role privileges"},
    },
)
async def list_candidate_blocks(
    section_id: str | None = Query(None, description="Filter by railway section ID"),
    opportunity_id: str | None = Query(None, description="Filter by integrated opportunity ID"),
    task_id: str | None = Query(None, description="Filter by maintenance task ID"),
    date_filter: date | None = Query(None, alias="date", description="Filter by planning date (YYYY-MM-DD)"),
    feasibility_status: str | None = Query(
        None, description="Filter by computed feasibility (FEASIBLE, TRAIN_CONFLICT, DURATION_INSUFFICIENT)"
    ),
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page (max 100)"),
    current_user: User = Depends(require_roles(*CANDIDATE_READ_ROLES)),
    db: AsyncSession = Depends(get_db),
) -> CandidateBlocksListResponse:
    """List candidate block options with filtering and pagination."""
    all_candidates = await CandidateBlockEngine.generate_candidates(
        db=db,
        section_id=section_id,
        opportunity_id=opportunity_id,
        task_id=task_id,
        date_filter=date_filter,
        feasibility_status=feasibility_status,
    )
    total = len(all_candidates)
    total_pages = (total + page_size - 1) // page_size if total > 0 else 1
    offset = (page - 1) * page_size
    paged_items = all_candidates[offset : offset + page_size]

    return CandidateBlocksListResponse(
        items=paged_items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get(
    "/{candidate_id}",
    response_model=CandidateBlockResponse,
    summary="Get candidate block details by ID (RBAC Protected)",
    description=(
        "Retrieve detailed feasibility, window fit, train conflicts, freight, and scoring "
        "attributes of a specific candidate block. "
        "Requires authentication and one of: ADMIN, PLANNER, ENGINEERING, SNT, TRD, CONTROL, APPROVER, VIEWER."
    ),
    responses={
        401: {"description": "Missing, invalid, or expired authentication token"},
        403: {"description": "Insufficient role privileges"},
        404: {"description": "Candidate block not found"},
    },
)
async def get_candidate_block(
    candidate_id: str,
    current_user: User = Depends(require_roles(*CANDIDATE_READ_ROLES)),
    db: AsyncSession = Depends(get_db),
) -> CandidateBlockResponse:
    """Get details of a specific candidate block."""
    cand = await CandidateBlockEngine.get_candidate_by_id(db=db, candidate_id=candidate_id)
    if not cand:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Candidate block with ID '{candidate_id}' not found",
        )
    return cand
