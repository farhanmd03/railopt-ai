"""What-If Scenario Analysis Router (Batch 7K).

Endpoints:
- POST /api/v1/optimization/runs/{run_id}/scenarios: Create and execute a What-If scenario (RBAC: ADMIN, PLANNER)
- GET /api/v1/optimization/runs/{run_id}/scenarios: List scenarios for a base run (RBAC: Authenticated)
- GET /api/v1/optimization/scenarios/{scenario_id}: Get scenario detail with full comparison against base run (RBAC: Authenticated)
"""

from __future__ import annotations

import json
import logging
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import User, require_roles
from app.domain.constraints import HardConstraintConfig
from app.domain.objectives import ObjectiveWeights
from app.domain.results import SolverStatus
from app.models.optimization import (
    OptimizationRun,
    OptimizationScenario,
    OptimizedBlock,
)
from app.routers.optimization import (
    OPTIMIZATION_READ_ROLES,
    OPTIMIZATION_TRIGGER_ROLES,
    _format_block_response,
    _format_run_response,
    _resolve_run,
)
from app.schemas.scenario import (
    OptimizationScenarioListResponse,
    OptimizationScenarioResponse,
    ScenarioBlockSummary,
    ScenarioComparisonSummary,
    ScenarioCreateRequest,
    ScenarioTaskImpact,
)
from app.services.optimization_service import OptimizationService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/optimization", tags=["What-If Scenario Analysis"])


def _format_scenario_response(
    scenario: OptimizationScenario,
    base_run: OptimizationRun | None = None,
    scenario_run: OptimizationRun | None = None,
    base_blocks: list[OptimizedBlock] | None = None,
    scenario_blocks: list[OptimizedBlock] | None = None,
) -> OptimizationScenarioResponse:
    """Format an OptimizationScenario DB model into API response contract."""
    params_dict: dict[str, Any] = {}
    try:
        if scenario.parameters:
            params_dict = json.loads(scenario.parameters)
    except Exception:
        pass

    formatted_base_run = _format_run_response(base_run) if base_run else None
    formatted_scenario_run = _format_run_response(scenario_run) if scenario_run else None

    comparison_summary = None
    task_impact = None
    block_diffs = None

    if base_run:
        b_blocks = base_blocks if base_blocks is not None else []
        s_blocks = scenario_blocks if scenario_blocks is not None else []

        c_summary, t_impact, b_diffs = OptimizationService.compute_run_comparison(
            base_run=base_run,
            scenario_run=scenario_run,
            base_blocks=b_blocks,
            scenario_blocks=s_blocks,
        )
        comparison_summary = ScenarioComparisonSummary(**c_summary)
        task_impact = ScenarioTaskImpact(**t_impact)
        block_diffs = ScenarioBlockSummary(
            added_block_count=b_diffs["added_block_count"],
            removed_block_count=b_diffs["removed_block_count"],
            retained_block_count=b_diffs["retained_block_count"],
            added_blocks=[_format_block_response(b) for b in b_diffs["added_blocks"]],
            removed_blocks=[_format_block_response(b) for b in b_diffs["removed_blocks"]],
            retained_blocks=[_format_block_response(b) for b in b_diffs["retained_blocks"]],
        )

    return OptimizationScenarioResponse(
        id=scenario.id,
        scenario_id=scenario.scenario_id,
        name=scenario.name,
        scenario_type=scenario.scenario_type,
        status=scenario.status,
        base_run_id=scenario.base_run_id,
        scenario_run_id=scenario.scenario_run_id,
        created_by=scenario.created_by,
        parameters=params_dict,
        notes=scenario.notes,
        created_at=scenario.created_at,
        base_run=formatted_base_run,
        scenario_run=formatted_scenario_run,
        comparison=comparison_summary,
        task_impact=task_impact,
        block_differences=block_diffs,
    )


@router.post(
    "/runs/{run_id}/scenarios",
    response_model=OptimizationScenarioResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create & Execute What-If Scenario (RBAC: ADMIN, PLANNER)",
    description=(
        "Executes a What-If Scenario with alternative soft weights, planning horizon, or excluded candidates "
        "using the existing CP-SAT mathematical solver without mutating the base optimization run."
    ),
    responses={
        201: {"description": "What-If Scenario successfully solved and persisted"},
        401: {"description": "Missing, invalid, or expired authentication token"},
        403: {"description": "Insufficient role privileges (requires ADMIN or PLANNER)"},
        404: {"description": "Base optimization run not found"},
        422: {"description": "Validation error in scenario parameters"},
    },
)
async def create_and_run_scenario(
    run_id: str,
    request: ScenarioCreateRequest,
    current_user: User = Depends(require_roles(*OPTIMIZATION_TRIGGER_ROLES)),
    db: AsyncSession = Depends(get_db),
) -> OptimizationScenarioResponse:
    """Create and run a What-If Scenario against a base optimization run."""
    # 1. Resolve and validate base run
    base_run = await _resolve_run(run_id, db)

    # 2. Build objective weights overriding with request parameters
    weights = ObjectiveWeights(
        weight_priority_score=request.weight_priority_score or 1.0,
        weight_integrated_task_bonus=request.weight_integrated_task_bonus or 10.0,
        weight_tasks_scheduled=request.weight_tasks_scheduled or 5.0,
        weight_overdue_mitigation=request.weight_overdue_mitigation or 2.0,
        weight_train_disruption=request.weight_train_disruption or 8.0,
        weight_freight_impact=request.weight_freight_impact or 3.0,
        weight_unused_window_time=request.weight_unused_window_time or 0.5,
        weight_total_block_count=request.weight_total_block_count or 1.0,
    )

    # Hard constraints remain strictly locked to prevent compromising railway safety rules
    hard_constraints = HardConstraintConfig()

    scenario_uid = f"SCEN-{uuid.uuid4().hex[:8].upper()}"

    param_dict = {
        "name": request.name,
        "scenario_type": request.scenario_type,
        "weights": {
            "weight_priority_score": weights.weight_priority_score,
            "weight_integrated_task_bonus": weights.weight_integrated_task_bonus,
            "weight_tasks_scheduled": weights.weight_tasks_scheduled,
            "weight_overdue_mitigation": weights.weight_overdue_mitigation,
            "weight_train_disruption": weights.weight_train_disruption,
            "weight_freight_impact": weights.weight_freight_impact,
            "weight_unused_window_time": weights.weight_unused_window_time,
            "weight_total_block_count": weights.weight_total_block_count,
        },
        "planning_start": request.planning_start.isoformat() if request.planning_start else None,
        "planning_end": request.planning_end.isoformat() if request.planning_end else None,
        "excluded_candidate_ids": request.excluded_candidate_ids,
        "notes": request.notes,
    }

    # 3. Create initial scenario record in RUNNING state
    scenario_record = OptimizationScenario(
        scenario_id=scenario_uid,
        name=request.name.strip(),
        scenario_type=request.scenario_type,
        status="RUNNING",
        base_run_id=base_run.id,
        created_by=current_user.username,
        parameters=json.dumps(param_dict),
        notes=request.notes,
    )
    db.add(scenario_record)
    await db.commit()
    await db.refresh(scenario_record)

    # 4. Execute CP-SAT solver and persist alternative scenario run
    try:
        scenario_run, run_result = await OptimizationService.run_and_persist_optimization(
            db=db,
            weights=weights,
            hard_constraints=hard_constraints,
            planning_start=request.planning_start,
            planning_end=request.planning_end,
            time_limit_seconds=request.solver_time_limit_seconds,
            run_type="scenario",
            excluded_candidate_ids=request.excluded_candidate_ids,
        )

        scenario_status = (
            "COMPLETED"
            if run_result.solver_status in (SolverStatus.OPTIMAL, SolverStatus.FEASIBLE)
            else "INFEASIBLE"
        )
        scenario_record.status = scenario_status
        scenario_record.scenario_run_id = scenario_run.id
        await db.commit()
        await db.refresh(scenario_record)

    except Exception as exc:
        logger.error("What-If scenario execution failed: %s", exc)
        scenario_record.status = "FAILED"
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Solver execution failed for scenario '{request.name}': {str(exc)}",
        ) from exc

    # 5. Fetch full blocks for comparison
    stmt_base_blocks = (
        select(OptimizedBlock)
        .options(selectinload(OptimizedBlock.tasks))
        .where(OptimizedBlock.optimization_run_id == base_run.id)
    )
    base_blocks = (await db.scalars(stmt_base_blocks)).all()

    stmt_scen_blocks = (
        select(OptimizedBlock)
        .options(selectinload(OptimizedBlock.tasks))
        .where(OptimizedBlock.optimization_run_id == scenario_run.id)
    )
    scen_blocks = (await db.scalars(stmt_scen_blocks)).all()

    logger.info(
        "Successfully executed What-If scenario '%s' (#%d, id: %s) against base run #%d",
        scenario_record.name,
        scenario_record.id,
        scenario_record.scenario_id,
        base_run.id,
    )

    return _format_scenario_response(
        scenario=scenario_record,
        base_run=base_run,
        scenario_run=scenario_run,
        base_blocks=base_blocks,
        scenario_blocks=scen_blocks,
    )


@router.get(
    "/runs/{run_id}/scenarios",
    response_model=OptimizationScenarioListResponse,
    status_code=status.HTTP_200_OK,
    summary="List Scenarios for Base Optimization Run (RBAC: Authenticated)",
    description="Retrieves all What-If scenarios created for a specific base optimization run.",
    responses={
        200: {"description": "List of What-If scenarios"},
        401: {"description": "Missing, invalid, or expired authentication token"},
        403: {"description": "Insufficient role privileges"},
        404: {"description": "Base optimization run not found"},
    },
)
async def list_scenarios_for_run(
    run_id: str,
    current_user: User = Depends(require_roles(*OPTIMIZATION_READ_ROLES)),
    db: AsyncSession = Depends(get_db),
) -> OptimizationScenarioListResponse:
    """List all What-If scenarios for a base optimization run."""
    base_run = await _resolve_run(run_id, db)

    stmt = (
        select(OptimizationScenario)
        .options(
            selectinload(OptimizationScenario.base_run),
            selectinload(OptimizationScenario.scenario_run),
        )
        .where(OptimizationScenario.base_run_id == base_run.id)
        .order_by(OptimizationScenario.created_at.desc(), OptimizationScenario.id.desc())
    )
    scenarios = (await db.scalars(stmt)).all()

    return OptimizationScenarioListResponse(
        items=[
            _format_scenario_response(
                scenario=s,
                base_run=s.base_run,
                scenario_run=s.scenario_run,
            )
            for s in scenarios
        ],
        total=len(scenarios),
    )


@router.get(
    "/scenarios/{scenario_id}",
    response_model=OptimizationScenarioResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Detailed Scenario with Comparison (RBAC: Authenticated)",
    description="Retrieves a specific What-If scenario with full before/after comparative metrics, block differences, and task impacts.",
    responses={
        200: {"description": "What-If Scenario detail with comparative analysis"},
        401: {"description": "Missing, invalid, or expired authentication token"},
        403: {"description": "Insufficient role privileges"},
        404: {"description": "Scenario not found"},
    },
)
async def get_scenario_detail(
    scenario_id: str,
    current_user: User = Depends(require_roles(*OPTIMIZATION_READ_ROLES)),
    db: AsyncSession = Depends(get_db),
) -> OptimizationScenarioResponse:
    """Retrieve What-If scenario details with comparative metrics."""
    stmt = (
        select(OptimizationScenario)
        .options(
            selectinload(OptimizationScenario.base_run),
            selectinload(OptimizationScenario.scenario_run),
        )
    )
    if scenario_id.isdigit():
        stmt = stmt.where(OptimizationScenario.id == int(scenario_id))
    else:
        stmt = stmt.where(OptimizationScenario.scenario_id == scenario_id)

    scenario = (await db.scalars(stmt)).first()
    if not scenario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"What-If scenario '{scenario_id}' was not found.",
        )

    base_blocks = []
    scen_blocks = []

    if scenario.base_run:
        stmt_b = (
            select(OptimizedBlock)
            .options(selectinload(OptimizedBlock.tasks))
            .where(OptimizedBlock.optimization_run_id == scenario.base_run.id)
        )
        base_blocks = (await db.scalars(stmt_b)).all()

    if scenario.scenario_run:
        stmt_s = (
            select(OptimizedBlock)
            .options(selectinload(OptimizedBlock.tasks))
            .where(OptimizedBlock.optimization_run_id == scenario.scenario_run.id)
        )
        scen_blocks = (await db.scalars(stmt_s)).all()

    return _format_scenario_response(
        scenario=scenario,
        base_run=scenario.base_run,
        scenario_run=scenario.scenario_run,
        base_blocks=base_blocks,
        scenario_blocks=scen_blocks,
    )
