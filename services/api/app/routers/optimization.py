"""Optimization API router with RBAC role authorization (Batch 6B.3).

Endpoints:
- POST /api/v1/optimization/runs: Trigger CP-SAT mathematical solve and persist results (ADMIN, PLANNER, CONTROL).
- GET  /api/v1/optimization/runs: List historical optimization runs with pagination and filtering.
- GET  /api/v1/optimization/runs/{run_id}: Retrieve optimization run summary and metadata.
- GET  /api/v1/optimization/runs/{run_id}/blocks: Retrieve paginated scheduled blocks for a specific run.
"""

from __future__ import annotations

import json
import logging
import math
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import User, require_roles
from app.domain.constraints import HardConstraintConfig
from app.domain.objectives import ObjectiveWeights
from app.models.optimization import (
    OptimizationRun,
    OptimizedBlock,
    OptimizedBlockTask,
)
from app.schemas.optimization import (
    OptimizationRunCreateRequest,
    OptimizationRunDetailResponse,
    OptimizationRunResponse,
    OptimizationRunsListResponse,
    OptimizedBlockResponse,
    OptimizedBlocksListResponse,
)
from app.services.optimization_service import OptimizationService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/optimization", tags=["Optimization Engine"])

# Roles permitted to initiate an optimization run
OPTIMIZATION_TRIGGER_ROLES = ("ADMIN", "PLANNER", "CONTROL")

# Roles permitted to read optimization results
OPTIMIZATION_READ_ROLES = (
    "ADMIN",
    "PLANNER",
    "CONTROL",
    "APPROVER",
    "VIEWER",
    "ENGINEERING",
    "SNT",
    "TRD",
)


def _format_block_response(block: OptimizedBlock) -> OptimizedBlockResponse:
    """Format an OptimizedBlock ORM entity into a clean Pydantic response."""
    expl_data: dict[str, Any] = {}
    if block.explanation:
        try:
            expl_data = json.loads(block.explanation)
        except Exception:
            expl_data = {"raw": block.explanation}

    depts = [d.strip() for d in block.departments_involved.split(",")] if block.departments_involved else []
    t_ids = [t.task_id for t in block.tasks] if block.tasks else []

    dur = float(block.block_duration_hrs) if block.block_duration_hrs is not None else 0.0
    prio = float(block.priority_score) if block.priority_score is not None else 0.0

    return OptimizedBlockResponse(
        id=block.id,
        optimization_run_id=block.optimization_run_id,
        optimized_block_id=expl_data.get("optimized_block_id", f"OPT-BLK-{block.id:04d}"),
        candidate_id=expl_data.get("candidate_id"),
        section_id=block.section_id or "UNKNOWN",
        block_start=block.block_start,
        block_end=block.block_end,
        block_duration_hrs=dur,
        block_type=block.block_type or ("integrated" if block.is_integrated else "single"),
        is_integrated=bool(block.is_integrated),
        departments_involved=depts,
        realized_priority_value=prio,
        candidate_priority_value=expl_data.get("candidate_priority_value"),
        train_conflicts=block.train_conflicts or 0,
        estimated_impact_score=block.estimated_impact_score,
        resource_status=expl_data.get("resource_status", "UNVERIFIED"),
        freight_impact=expl_data.get("freight_impact"),
        task_ids=t_ids,
        status=block.status or "Candidate",
        explanation=expl_data,
        created_at=block.created_at,
    )


def _format_run_response(run: OptimizationRun) -> OptimizationRunResponse:
    """Format an OptimizationRun ORM entity into a clean Pydantic response."""
    param_data: dict[str, Any] = {}
    if run.parameters:
        try:
            param_data = json.loads(run.parameters)
        except Exception:
            param_data = {}

    metrics = param_data.get("metrics", {})
    run_domain_id = param_data.get("run_id", f"RUN-{run.id:04d}")

    return OptimizationRunResponse(
        id=run.id,
        run_id=run_domain_id,
        run_type=run.run_type or "standard",
        planning_horizon_start=run.planning_horizon_start,
        planning_horizon_end=run.planning_horizon_end,
        status=run.status or "Completed",
        solver_status=run.solver_status or "UNKNOWN",
        objective_value=run.objective_value,
        solve_time_seconds=run.solve_time_seconds,
        tasks_considered=metrics.get("tasks_considered", 0),
        tasks_scheduled=metrics.get("tasks_scheduled", 0),
        tasks_unassigned=metrics.get("tasks_unassigned", 0),
        integrated_block_count=metrics.get("integrated_block_count", 0),
        separate_block_count=metrics.get("separate_block_count", 0),
        estimated_total_block_hours=metrics.get("estimated_total_block_hours", 0.0),
        unassigned_task_ids=param_data.get("unassigned_tasks", []),
        warnings=param_data.get("warnings", []),
        notes=run.notes,
        created_at=run.created_at,
    )


async def _resolve_run(run_id_param: str, db: AsyncSession) -> OptimizationRun:
    """Resolve an OptimizationRun by integer ID or string run_id identifier."""
    if run_id_param.isdigit():
        stmt = (
            select(OptimizationRun)
            .options(
                selectinload(OptimizationRun.optimized_blocks).selectinload(OptimizedBlock.tasks)
            )
            .where(OptimizationRun.id == int(run_id_param))
        )
        run = (await db.scalars(stmt)).first()
        if run:
            return run

    # Fallback search by JSON run_id parameter
    stmt = (
        select(OptimizationRun)
        .options(
            selectinload(OptimizationRun.optimized_blocks).selectinload(OptimizedBlock.tasks)
        )
        .where(OptimizationRun.parameters.like(f'%"{run_id_param}"%'))
    )
    run = (await db.scalars(stmt)).first()
    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Optimization run '{run_id_param}' was not found.",
        )
    return run


@router.post(
    "/runs",
    response_model=OptimizationRunResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Trigger optimization run (RBAC: ADMIN, PLANNER, CONTROL)",
    description=(
        "Executes the in-memory Google OR-Tools CP-SAT mathematical solver over the authentic railway dataset "
        "and transactionally persists the resulting schedule recommendations into PostgreSQL.\n\n"
        "**Decision Support Disclaimer**: The output represents algorithmic candidate recommendations ('status': 'Candidate') "
        "and is NOT an officially approved railway block possession schedule until ratified by human authorities."
    ),
    responses={
        201: {"description": "Optimization run completed and persisted successfully"},
        401: {"description": "Missing, invalid, or expired authentication token"},
        403: {"description": "Insufficient role privileges (requires ADMIN, PLANNER, or CONTROL)"},
        422: {"description": "Invalid input parameters"},
        500: {"description": "Server or solver execution failure"},
    },
)
async def create_optimization_run(
    payload: OptimizationRunCreateRequest,
    current_user: User = Depends(require_roles(*OPTIMIZATION_TRIGGER_ROLES)),
    db: AsyncSession = Depends(get_db),
) -> OptimizationRunResponse:
    """Initiate a CP-SAT optimization solve with optional constraint/weight overrides."""
    # Build ObjectiveWeights with safe caller overrides
    weights = ObjectiveWeights(
        weight_priority_score=(
            payload.weight_priority_score
            if payload.weight_priority_score is not None
            else 1.0
        ),
        weight_integrated_task_bonus=(
            payload.weight_integrated_task_bonus
            if payload.weight_integrated_task_bonus is not None
            else 0.5
        ),
        weight_tasks_scheduled=(
            payload.weight_tasks_scheduled
            if payload.weight_tasks_scheduled is not None
            else 0.8
        ),
        weight_overdue_mitigation=(
            payload.weight_overdue_mitigation
            if payload.weight_overdue_mitigation is not None
            else 0.3
        ),
        weight_train_disruption=(
            payload.weight_train_disruption
            if payload.weight_train_disruption is not None
            else 2.0
        ),
        weight_freight_impact=(
            payload.weight_freight_impact
            if payload.weight_freight_impact is not None
            else 0.5
        ),
        weight_unused_window_time=(
            payload.weight_unused_window_time
            if payload.weight_unused_window_time is not None
            else 0.2
        ),
        weight_total_block_count=(
            payload.weight_total_block_count
            if payload.weight_total_block_count is not None
            else 0.1
        ),
    )

    # Build HardConstraintConfig
    constraints = HardConstraintConfig(
        max_block_duration_hrs=payload.max_block_duration_hrs,
        allow_train_conflict=payload.allow_train_conflicts,
        require_candidate_feasible=True,
        require_resource_feasibility=payload.require_resource_feasibility,
    )

    try:
        run_record, _ = await OptimizationService.run_and_persist_optimization(
            db=db,
            weights=weights,
            hard_constraints=constraints,
            planning_start=payload.planning_start,
            planning_end=payload.planning_end,
            time_limit_seconds=payload.solver_time_limit_seconds,
            run_type=payload.run_type,
        )
        return _format_run_response(run_record)
    except Exception as e:
        logger.error("Failed to execute optimization run: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while executing the optimization solver. Check server logs for details.",
        )


@router.get(
    "/runs",
    response_model=OptimizationRunsListResponse,
    summary="List historical optimization runs (RBAC Protected)",
    description=(
        "Retrieve a paginated list of historical optimization runs.\n\n"
        "Requires authentication and one of: ADMIN, PLANNER, CONTROL, APPROVER, VIEWER, ENGINEERING, SNT, TRD."
    ),
    responses={
        401: {"description": "Missing, invalid, or expired authentication token"},
        403: {"description": "Insufficient role privileges"},
    },
)
async def list_optimization_runs(
    status_filter: str | None = Query(None, alias="status", description="Filter by status ('Completed', 'Failed')"),
    solver_status: str | None = Query(None, description="Filter by solver status ('OPTIMAL', 'FEASIBLE', 'INFEASIBLE')"),
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page (max 100)"),
    current_user: User = Depends(require_roles(*OPTIMIZATION_READ_ROLES)),
    db: AsyncSession = Depends(get_db),
) -> OptimizationRunsListResponse:
    """List historical optimization runs with pagination."""
    base_query = select(OptimizationRun)
    if status_filter:
        base_query = base_query.where(OptimizationRun.status == status_filter)
    if solver_status:
        base_query = base_query.where(OptimizationRun.solver_status == solver_status)

    total = (
        await db.scalar(
            select(func.count()).select_from(base_query.subquery())
        )
    ) or 0

    stmt = (
        base_query.order_by(OptimizationRun.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    runs = (await db.scalars(stmt)).all()
    total_pages = math.ceil(total / page_size) if total > 0 else 0

    return OptimizationRunsListResponse(
        items=[_format_run_response(r) for r in runs],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get(
    "/runs/{run_id}",
    response_model=OptimizationRunDetailResponse,
    summary="Get optimization run details (RBAC Protected)",
    description=(
        "Retrieve comprehensive optimization run results and metadata by run ID.\n\n"
        "Requires authentication and one of: ADMIN, PLANNER, CONTROL, APPROVER, VIEWER, ENGINEERING, SNT, TRD."
    ),
    responses={
        401: {"description": "Missing, invalid, or expired authentication token"},
        403: {"description": "Insufficient role privileges"},
        404: {"description": "Optimization run not found"},
    },
)
async def get_optimization_run(
    run_id: str,
    current_user: User = Depends(require_roles(*OPTIMIZATION_READ_ROLES)),
    db: AsyncSession = Depends(get_db),
) -> OptimizationRunDetailResponse:
    """Retrieve detailed optimization run including scheduled block recommendations."""
    run = await _resolve_run(run_id, db)
    run_resp = _format_run_response(run)

    blocks = [_format_block_response(b) for b in run.optimized_blocks]
    return OptimizationRunDetailResponse(
        **run_resp.model_dump(),
        scheduled_blocks=blocks,
    )


@router.get(
    "/runs/{run_id}/blocks",
    response_model=OptimizedBlocksListResponse,
    summary="Get scheduled blocks for an optimization run (RBAC Protected)",
    description=(
        "Retrieve paginated scheduled maintenance blocks for a specific optimization run.\n\n"
        "Requires authentication and one of: ADMIN, PLANNER, CONTROL, APPROVER, VIEWER, ENGINEERING, SNT, TRD."
    ),
    responses={
        401: {"description": "Missing, invalid, or expired authentication token"},
        403: {"description": "Insufficient role privileges"},
        404: {"description": "Optimization run not found"},
    },
)
async def get_optimization_run_blocks(
    run_id: str,
    section_id: str | None = Query(None, description="Filter by railway section ID"),
    is_integrated: bool | None = Query(None, description="Filter by integrated block flag"),
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page (max 100)"),
    current_user: User = Depends(require_roles(*OPTIMIZATION_READ_ROLES)),
    db: AsyncSession = Depends(get_db),
) -> OptimizedBlocksListResponse:
    """Retrieve paginated blocks strictly belonging to the specified optimization run."""
    run = await _resolve_run(run_id, db)

    base_query = (
        select(OptimizedBlock)
        .options(selectinload(OptimizedBlock.tasks))
        .where(OptimizedBlock.optimization_run_id == run.id)
    )

    if section_id:
        base_query = base_query.where(OptimizedBlock.section_id == section_id)
    if is_integrated is not None:
        base_query = base_query.where(OptimizedBlock.is_integrated == is_integrated)

    total = (
        await db.scalar(
            select(func.count()).select_from(base_query.subquery())
        )
    ) or 0

    stmt = (
        base_query.order_by(OptimizedBlock.id.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    blocks = (await db.scalars(stmt)).all()
    total_pages = math.ceil(total / page_size) if total > 0 else 0

    return OptimizedBlocksListResponse(
        items=[_format_block_response(b) for b in blocks],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )
