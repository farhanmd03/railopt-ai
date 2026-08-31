"""Audit API router (Batch 7J).

Endpoints:
- GET /api/v1/audit/optimization-runs/{run_id}: Retrieve chronological audit trail for an optimization run.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import User, require_roles
from app.models.admin import AuditLog
from app.models.optimization import OptimizationRun
from app.schemas.audit import AuditLogListResponse, AuditLogResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/audit", tags=["Audit Trail"])

AUDIT_READ_ROLES = (
    "ADMIN",
    "PLANNER",
    "CONTROL",
    "APPROVER",
    "VIEWER",
    "ENGINEERING",
    "SNT",
    "TRD",
)


async def _resolve_run_id(run_id_param: str, db: AsyncSession) -> int:
    """Resolve OptimizationRun ID from integer ID or parameters."""
    if run_id_param.isdigit():
        stmt = select(OptimizationRun.id).where(OptimizationRun.id == int(run_id_param))
        run_db_id = (await db.scalars(stmt)).first()
        if run_db_id:
            return run_db_id

    stmt = select(OptimizationRun.id).where(
        OptimizationRun.parameters.like(f'%"{run_id_param}"%')
    )
    run_db_id = (await db.scalars(stmt)).first()
    if not run_db_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Optimization run '{run_id_param}' was not found.",
        )
    return run_db_id


@router.get(
    "/optimization-runs/{run_id}",
    response_model=AuditLogListResponse,
    status_code=status.HTTP_200_OK,
    summary="Get chronological audit trail for optimization run (RBAC: Authenticated Users)",
    description="Retrieves the immutable, chronological audit trail of all state transitions and review decisions for this optimization run.",
    responses={
        200: {"description": "List of chronological audit log entries"},
        401: {"description": "Missing, invalid, or expired authentication token"},
        403: {"description": "Insufficient role privileges"},
        404: {"description": "Optimization run not found"},
    },
)
async def get_optimization_run_audit_trail(
    run_id: str,
    current_user: User = Depends(require_roles(*AUDIT_READ_ROLES)),
    db: AsyncSession = Depends(get_db),
) -> AuditLogListResponse:
    """Retrieve chronological audit trail for a specific optimization run."""
    run_db_id = await _resolve_run_id(run_id, db)

    stmt = (
        select(AuditLog)
        .where(
            AuditLog.entity_type == "OptimizationRun",
            AuditLog.entity_id == str(run_db_id),
        )
        .order_by(AuditLog.timestamp.asc(), AuditLog.id.asc())
    )
    audit_logs = (await db.scalars(stmt)).all()

    return AuditLogListResponse(
        items=[
            AuditLogResponse(
                id=a.id,
                timestamp=a.timestamp,
                user_id=a.user_id,
                action=a.action,
                entity_type=a.entity_type,
                entity_id=a.entity_id,
                before_value=a.before_value,
                after_value=a.after_value,
                details=a.details,
                ip_address=a.ip_address,
            )
            for a in audit_logs
        ],
        total=len(audit_logs),
    )
