"""Maintenance tasks API router with RBAC role authorization."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import User, require_roles
from app.schemas.common import PaginatedResponse
from app.schemas.maintenance import (
    MaintenanceTaskDetailResponse,
    MaintenanceTaskResponse,
    PriorityAssessmentResponse,
)
from app.services.maintenance_service import MaintenanceService
from app.services.priority_engine import PriorityEngine

router = APIRouter(prefix="/maintenance-tasks", tags=["Maintenance Tasks"])

# Roles authorized to view maintenance task records
MAINTENANCE_READ_ROLES = (
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
    response_model=PaginatedResponse[MaintenanceTaskResponse],
    summary="List maintenance tasks (RBAC Protected)",
    description=(
        "Retrieve a paginated list of maintenance tasks. "
        "Requires authentication and one of: ADMIN, PLANNER, ENGINEERING, SNT, TRD, CONTROL, APPROVER, VIEWER."
    ),
    responses={
        401: {"description": "Missing, invalid, or expired authentication token"},
        403: {"description": "Insufficient role privileges"},
    },
)
async def list_maintenance_tasks(
    department: str | None = Query(None, description="Filter by department (Engineering, S&T, TRD)"),
    severity: str | None = Query(None, description="Filter by severity (Low, Medium, High, Critical)"),
    status_filter: str | None = Query(None, alias="status", description="Filter by status (Open, InProgress, Completed, Cancelled)"),
    section_id: str | None = Query(None, description="Filter by section ID"),
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page (max 100)"),
    current_user: User = Depends(require_roles(*MAINTENANCE_READ_ROLES)),
    db: AsyncSession = Depends(get_db),
) -> PaginatedResponse[MaintenanceTaskResponse]:
    """List maintenance tasks with pagination and filters for authorized users."""
    items, total = await MaintenanceService.get_maintenance_tasks(
        db=db,
        department=department,
        severity=severity,
        status=status_filter,
        section_id=section_id,
        page=page,
        page_size=page_size,
    )
    return PaginatedResponse.create(
        items=[MaintenanceTaskResponse.model_validate(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/{task_id}",
    response_model=MaintenanceTaskDetailResponse,
    summary="Get maintenance task details (RBAC Protected)",
    description=(
        "Retrieve detailed attributes of a specific maintenance task. "
        "Requires authentication and one of: ADMIN, PLANNER, ENGINEERING, SNT, TRD, CONTROL, APPROVER, VIEWER."
    ),
    responses={
        401: {"description": "Missing, invalid, or expired authentication token"},
        403: {"description": "Insufficient role privileges"},
        404: {"description": "Maintenance task not found"},
    },
)
async def get_maintenance_task(
    task_id: str,
    current_user: User = Depends(require_roles(*MAINTENANCE_READ_ROLES)),
    db: AsyncSession = Depends(get_db),
) -> MaintenanceTaskDetailResponse:
    """Get maintenance task details by task ID for authorized users."""
    task = await MaintenanceService.get_maintenance_task_by_id(db=db, task_id=task_id)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Maintenance task with ID '{task_id}' not found",
        )
    return MaintenanceTaskDetailResponse.model_validate(task)


@router.get(
    "/{task_id}/priority",
    response_model=PriorityAssessmentResponse,
    summary="Get maintenance task priority assessment (RBAC Protected)",
    description=(
        "Retrieve deterministic prototype maintenance priority assessment for a specific task. "
        "Evaluated dynamically from task and asset data. "
        "Requires authentication and one of: ADMIN, PLANNER, ENGINEERING, SNT, TRD, CONTROL, APPROVER, VIEWER."
    ),
    responses={
        401: {"description": "Missing, invalid, or expired authentication token"},
        403: {"description": "Insufficient role privileges"},
        404: {"description": "Maintenance task not found"},
    },
)
async def get_maintenance_task_priority(
    task_id: str,
    current_user: User = Depends(require_roles(*MAINTENANCE_READ_ROLES)),
    db: AsyncSession = Depends(get_db),
) -> PriorityAssessmentResponse:
    """Get deterministic priority assessment for a specific maintenance task."""
    assessment = await PriorityEngine.evaluate_task_priority(db=db, task_id=task_id)
    if not assessment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Maintenance task with ID '{task_id}' not found",
        )
    return assessment
