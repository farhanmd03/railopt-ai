"""Possession Outcome API router (Badge 4B).

Endpoints:
- POST  /api/v1/optimization/blocks/{block_id}/possession-outcomes: Create a new execution outcome.
- GET   /api/v1/optimization/blocks/{block_id}/possession-outcomes: List outcomes for a block.
- PATCH /api/v1/possession-outcomes/{outcome_id}: Update an existing execution outcome.
- GET   /api/v1/possession-outcomes/{outcome_id}: Retrieve details of a specific outcome.
"""

from datetime import datetime, timezone
import json
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import User, require_roles
from app.models.admin import AuditLog
from app.models.optimization import OptimizedBlock
from app.models.possession_outcome import PossessionOutcome, PossessionOutcomeStatus
from app.schemas.possession_outcome import (
    PossessionOutcomeCreateRequest,
    PossessionOutcomeResponse,
    PossessionOutcomeUpdateRequest,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Possession Outcomes"])

OUTCOME_WRITE_ROLES = ("ADMIN", "PLANNER", "CONTROL")
OUTCOME_READ_ROLES = (
    "ADMIN",
    "PLANNER",
    "CONTROL",
    "APPROVER",
    "VIEWER",
    "ENGINEERING",
    "SNT",
    "TRD",
)


def _format_outcome_response(outcome: PossessionOutcome) -> PossessionOutcomeResponse:
    """Format a PossessionOutcome ORM entity into a clean Pydantic response."""
    return PossessionOutcomeResponse(
        id=outcome.id,
        optimized_block_id=outcome.optimized_block_id,
        planned_start=outcome.planned_start,
        planned_end=outcome.planned_end,
        actual_start=outcome.actual_start,
        actual_end=outcome.actual_end,
        status=outcome.status.value if hasattr(outcome.status, "value") else str(outcome.status),
        delay_minutes=outcome.delay_minutes,
        cancellation_reason=outcome.cancellation_reason,
        affected_departments=outcome.affected_departments,
        planned_impact_score=outcome.planned_impact_score,
        actual_impact_score=outcome.actual_impact_score,
        notes=outcome.notes,
        recorded_by=outcome.recorded_by,
        created_at=outcome.created_at,
        updated_at=outcome.updated_at,
    )


@router.post(
    "/optimization/blocks/{block_id}/possession-outcomes",
    response_model=PossessionOutcomeResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a possession outcome for a scheduled block",
)
async def create_possession_outcome(
    block_id: int,
    payload: PossessionOutcomeCreateRequest,
    current_user: User = Depends(require_roles(*OUTCOME_WRITE_ROLES)),
    db: AsyncSession = Depends(get_db),
) -> PossessionOutcomeResponse:
    """Create a governance execution record for a finalized optimized block."""
    block = await db.get(OptimizedBlock, block_id)
    if not block:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Optimized block with ID '{block_id}' was not found.",
        )

    # Check if an outcome already exists for this block
    stmt = select(PossessionOutcome).where(PossessionOutcome.optimized_block_id == block.id)
    existing_outcome = (await db.scalars(stmt)).first()
    if existing_outcome:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A possession outcome already exists for block {block_id}.",
        )

    try:
        parsed_status = PossessionOutcomeStatus[payload.status]
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid status '{payload.status}'",
        )

    outcome = PossessionOutcome(
        optimized_block_id=block.id,
        planned_start=payload.planned_start,
        planned_end=payload.planned_end,
        actual_start=payload.actual_start,
        actual_end=payload.actual_end,
        status=parsed_status,
        delay_minutes=payload.delay_minutes,
        cancellation_reason=payload.cancellation_reason,
        affected_departments=payload.affected_departments,
        planned_impact_score=payload.planned_impact_score,
        actual_impact_score=payload.actual_impact_score,
        notes=payload.notes,
        recorded_by=current_user.username,
    )

    db.add(outcome)
    await db.flush()

    # Generate Audit Trail Entry
    now = datetime.now(timezone.utc)
    audit_event = AuditLog(
        timestamp=now,
        user_id=current_user.username,
        action="POSSESSION_OUTCOME_CREATED",
        entity_type="PossessionOutcome",
        entity_id=str(outcome.id),
        before_value=None,
        after_value=json.dumps(
            {
                "optimized_block_id": outcome.optimized_block_id,
                "status": outcome.status.value,
                "recorded_by": outcome.recorded_by,
            }
        ),
        details=f"Execution outcome initialized with status {outcome.status.value}.",
    )
    db.add(audit_event)

    await db.commit()
    await db.refresh(outcome)

    logger.info(
        "Possession outcome created for block %s by '%s'",
        block_id,
        current_user.username,
    )

    return _format_outcome_response(outcome)


@router.get(
    "/optimization/blocks/{block_id}/possession-outcomes",
    response_model=list[PossessionOutcomeResponse],
    summary="List possession outcomes for a block",
)
async def list_block_possession_outcomes(
    block_id: int,
    current_user: User = Depends(require_roles(*OUTCOME_READ_ROLES)),
    db: AsyncSession = Depends(get_db),
) -> list[PossessionOutcomeResponse]:
    """Retrieve execution outcomes for a specific block."""
    stmt = select(PossessionOutcome).where(PossessionOutcome.optimized_block_id == block_id)
    outcomes = (await db.scalars(stmt)).all()
    return [_format_outcome_response(o) for o in outcomes]


@router.get(
    "/possession-outcomes/{outcome_id}",
    response_model=PossessionOutcomeResponse,
    summary="Get possession outcome by ID",
)
async def get_possession_outcome(
    outcome_id: int,
    current_user: User = Depends(require_roles(*OUTCOME_READ_ROLES)),
    db: AsyncSession = Depends(get_db),
) -> PossessionOutcomeResponse:
    """Retrieve detailed execution outcome."""
    outcome = await db.get(PossessionOutcome, outcome_id)
    if not outcome:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Possession outcome '{outcome_id}' was not found.",
        )
    return _format_outcome_response(outcome)


@router.patch(
    "/possession-outcomes/{outcome_id}",
    response_model=PossessionOutcomeResponse,
    summary="Update possession outcome",
)
async def update_possession_outcome(
    outcome_id: int,
    payload: PossessionOutcomeUpdateRequest,
    current_user: User = Depends(require_roles(*OUTCOME_WRITE_ROLES)),
    db: AsyncSession = Depends(get_db),
) -> PossessionOutcomeResponse:
    """Update execution timeline, status, or impact for a block possession."""
    outcome = await db.get(PossessionOutcome, outcome_id)
    if not outcome:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Possession outcome '{outcome_id}' was not found.",
        )

    before_state = {
        "status": outcome.status.value if hasattr(outcome.status, "value") else str(outcome.status),
        "actual_start": outcome.actual_start.isoformat() if outcome.actual_start else None,
        "actual_end": outcome.actual_end.isoformat() if outcome.actual_end else None,
        "delay_minutes": outcome.delay_minutes,
        "cancellation_reason": outcome.cancellation_reason,
    }

    updated_fields = payload.model_dump(exclude_unset=True)
    if "status" in updated_fields:
        try:
            outcome.status = PossessionOutcomeStatus[updated_fields["status"]]
        except KeyError:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid status '{updated_fields['status']}'",
            )
        del updated_fields["status"]

    for key, value in updated_fields.items():
        setattr(outcome, key, value)

    # Generate Audit Trail Entry
    now = datetime.now(timezone.utc)
    after_state = {
        "status": outcome.status.value if hasattr(outcome.status, "value") else str(outcome.status),
        "actual_start": outcome.actual_start.isoformat() if outcome.actual_start else None,
        "actual_end": outcome.actual_end.isoformat() if outcome.actual_end else None,
        "delay_minutes": outcome.delay_minutes,
        "cancellation_reason": outcome.cancellation_reason,
    }

    audit_event = AuditLog(
        timestamp=now,
        user_id=current_user.username,
        action="POSSESSION_OUTCOME_UPDATED",
        entity_type="PossessionOutcome",
        entity_id=str(outcome.id),
        before_value=json.dumps(before_state),
        after_value=json.dumps(after_state),
        details="Execution outcome tracking updated.",
    )
    db.add(audit_event)

    await db.commit()
    await db.refresh(outcome)

    logger.info(
        "Possession outcome %s updated by '%s'",
        outcome_id,
        current_user.username,
    )

    return _format_outcome_response(outcome)