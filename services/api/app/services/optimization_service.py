"""Optimization Service and Database Persistence Layer (Batch 6B.2).

=============================================================================
DISCLAIMER & PURPOSE:
This service orchestrates the end-to-end server-side optimization workflow:
1. Loads authentic maintenance, candidate, and railway asset data from PostgreSQL.
2. Converts ORM records into pure domain contracts.
3. Invokes the in-memory CP-SAT mathematical solver (CPSATSolver).
4. Transactionally persists successful optimization runs, scheduled blocks,
   and block-task junctions to `optimization_runs`, `optimized_blocks`,
   and `optimized_block_tasks`.

All database writes are strictly isolated to optimization output tables.
Source railway datasets (assets, tasks, sections, windows, occupancies) remain
strictly read-only and unmodified.
=============================================================================
"""

from __future__ import annotations

from datetime import datetime, timedelta
import json
import logging
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.domain.candidate import OptimizationCandidate
from app.domain.constraints import HardConstraintConfig
from app.domain.objectives import ObjectiveWeights
from app.domain.results import OptimizationRunResult, SolverStatus
from app.domain.task import OptimizationTask
from app.models.asset import MaintenanceTask
from app.models.operations import TrainSectionOccupancy
from app.models.optimization import (
    OptimizationRun,
    OptimizedBlock,
    OptimizedBlockTask,
)
from app.schemas.readiness import PossessionReadinessResponse, ReadinessCheck
from app.schemas.scenario import CounterfactualBlockData, CounterfactualComparison
from app.services.candidate_block_engine import CandidateBlockEngine, check_train_conflicts
from app.services.optimizer_engine import CPSATSolver
from app.services.priority_engine import compute_priority

logger = logging.getLogger(__name__)


class OptimizationService:
    """Server-side service orchestrating CP-SAT optimization and atomic database persistence."""

    @classmethod
    async def prepare_domain_inputs(
        cls,
        db: AsyncSession,
        excluded_candidate_ids: list[str] | None = None,
    ) -> tuple[list[OptimizationTask], list[OptimizationCandidate]]:
        """Load database records and convert them into domain contracts for the solver."""
        # 1. Generate candidate blocks from candidate engine
        cand_responses = await CandidateBlockEngine.generate_candidates(db)

        excluded_set = set(excluded_candidate_ids or [])
        domain_candidates = [
            OptimizationCandidate(
                candidate_id=c.candidate_id,
                section_id=c.section_id,
                window_id=c.window_id,
                candidate_start=c.candidate_start,
                candidate_end=c.candidate_end,
                required_duration_hrs=c.required_duration_hrs,
                window_duration_hrs=c.window_duration_hrs,
                task_ids=c.task_ids,
                departments_involved=c.departments_involved,
                opportunity_id=c.opportunity_id,
                priority_score=c.priority_score,
                compatibility_score=c.compatibility_score,
                candidate_score=c.candidate_score,
                train_conflict=c.train_conflict,
                train_conflict_count=c.train_conflict_count,
                freight_data_available=c.freight_data_available,
                freight_level=c.freight_level,
                forecast_freight_trains=c.forecast_freight_trains,
                forecast_tonnage=c.forecast_tonnage,
                resource_check=c.resource_check,
                resource_ids=c.resource_ids,
                source_window_status=c.source_window_status,
                computed_feasibility_status=c.computed_feasibility_status,
                warnings=c.warnings,
                reasons=c.reasons,
            )
            for c in cand_responses
            if c.candidate_id not in excluded_set
        ]

        # 2. Extract unique task IDs present in the candidate universe
        all_task_ids = {tid for c in domain_candidates for tid in c.task_ids}

        # 3. Load authentic MaintenanceTask records with associated Asset records
        stmt = (
            select(MaintenanceTask)
            .options(selectinload(MaintenanceTask.asset))
            .where(MaintenanceTask.task_id.in_(all_task_ids))
        )
        db_tasks = (await db.scalars(stmt)).all()

        domain_tasks: list[OptimizationTask] = []
        for t in db_tasks:
            crit = t.asset.criticality_index if t.asset else None
            risk = t.asset.failure_risk_score if t.asset else None
            dur = float(t.required_duration_hrs) if t.required_duration_hrs is not None else 2.0
            cost = float(t.postpone_penalty_cost) if t.postpone_penalty_cost is not None else None

            # Execute real XGBoost ML Risk Prediction for task
            from app.services.ml_risk_predictor import MlRiskPredictor
            ml_pred = MlRiskPredictor.predict_risk(
                task_id=t.task_id,
                severity=t.severity,
                days_overdue=t.days_overdue,
                required_duration_hrs=dur,
                postpone_penalty_cost=cost,
                department=t.department,
                criticality_index=crit,
                failure_risk_score=risk,
            )

            p_res = compute_priority(
                task_id=t.task_id,
                department=t.department,
                severity=t.severity,
                days_overdue=t.days_overdue,
                asset_id=t.asset_id,
                section_id=t.section_id,
                criticality_index=crit,
                failure_risk_score=risk,
                baseline_priority_score=t.priority_score,
                ml_risk_score=ml_pred.risk_score,
            )
            # Duration on OptimizationTask is informative; candidate blocks carry required_duration_hrs
            domain_tasks.append(
                OptimizationTask(
                    task_id=t.task_id,
                    section_id=t.section_id or "UNKNOWN",
                    department=t.department,
                    duration_hrs=dur,
                    priority_score=p_res.computed_priority_score,
                    days_overdue=t.days_overdue,
                    asset_id=t.asset_id,
                    severity=t.severity,
                )
            )

        return domain_tasks, domain_candidates

    @classmethod
    async def run_and_persist_optimization(
        cls,
        db: AsyncSession,
        weights: ObjectiveWeights | None = None,
        hard_constraints: HardConstraintConfig | None = None,
        planning_start: datetime | None = None,
        planning_end: datetime | None = None,
        time_limit_seconds: float = 10.0,
        random_seed: int = 42,
        run_type: str = "standard",
        excluded_candidate_ids: list[str] | None = None,
    ) -> tuple[OptimizationRun, OptimizationRunResult]:
        """Execute CP-SAT solve and atomically persist results to PostgreSQL."""
        weights = weights or ObjectiveWeights()
        hard_constraints = hard_constraints or HardConstraintConfig()

        # 1. Load domain inputs
        domain_tasks, domain_candidates = await cls.prepare_domain_inputs(
            db, excluded_candidate_ids=excluded_candidate_ids
        )

        # 2. Execute in-memory mathematical solver
        run_result = CPSATSolver.solve(
            tasks=domain_tasks,
            candidates=domain_candidates,
            weights=weights,
            hard_constraints=hard_constraints,
            planning_start=planning_start,
            planning_end=planning_end,
            time_limit_seconds=time_limit_seconds,
            random_seed=random_seed,
        )

        # 3. Transactional Database Persistence
        return await cls.persist_run_result(
            db=db,
            run_result=run_result,
            run_type=run_type,
            weights=weights,
            hard_constraints=hard_constraints,
            excluded_candidate_ids=excluded_candidate_ids,
        )

    @classmethod
    async def persist_run_result(
        cls,
        db: AsyncSession,
        run_result: OptimizationRunResult,
        run_type: str = "standard",
        weights: ObjectiveWeights | None = None,
        hard_constraints: HardConstraintConfig | None = None,
        excluded_candidate_ids: list[str] | None = None,
    ) -> tuple[OptimizationRun, OptimizationRunResult]:
        """Persist solver run results and scheduled blocks atomically into the database."""
        weights = weights or ObjectiveWeights()
        hard_constraints = hard_constraints or HardConstraintConfig()

        try:
            # Build parameter metadata JSON
            param_dict: dict[str, Any] = {
                "run_id": run_result.run_id,
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
                "hard_constraints": {
                    "max_block_duration_hrs": hard_constraints.max_block_duration_hrs,
                    "allow_train_conflict": hard_constraints.allow_train_conflict,
                    "require_candidate_feasible": hard_constraints.require_candidate_feasible,
                    "require_resource_feasibility": hard_constraints.require_resource_feasibility,
                    "max_tasks_per_block": hard_constraints.max_tasks_per_block,
                    "enforce_single_assignment_per_task": hard_constraints.enforce_single_assignment_per_task,
                },
                "metrics": {
                    "tasks_considered": run_result.tasks_considered,
                    "tasks_scheduled": run_result.tasks_scheduled,
                    "tasks_unassigned": run_result.tasks_unassigned,
                    "integrated_block_count": run_result.integrated_block_count,
                    "separate_block_count": run_result.separate_block_count,
                    "estimated_total_block_hours": run_result.estimated_total_block_hours,
                },
                "unassigned_tasks": run_result.unassigned_tasks,
                "warnings": run_result.warnings[:50] if len(run_result.warnings) > 50 else run_result.warnings,
                "warning_count": len(run_result.warnings),
                "excluded_candidate_ids": excluded_candidate_ids or [],
            }

            status_str = (
                "Completed"
                if run_result.solver_status in (SolverStatus.OPTIMAL, SolverStatus.FEASIBLE)
                else "Failed"
            )

            run_record = OptimizationRun(
                run_type=run_type,
                planning_horizon_start=run_result.planning_start,
                planning_horizon_end=run_result.planning_end,
                status=status_str,
                solver_status=run_result.solver_status.value,
                objective_value=run_result.objective_value,
                solve_time_seconds=run_result.solver_runtime_seconds,
                parameters=json.dumps(param_dict),
                notes=f"Optimization run {run_result.run_id} executed with status {run_result.solver_status.value}",
                approval_status="DRAFT",
            )
            db.add(run_record)
            await db.flush()  # Populates run_record.id

            # If solver succeeded, persist scheduled blocks and block-task junctions
            if run_result.solver_status in (SolverStatus.OPTIMAL, SolverStatus.FEASIBLE):
                for b in run_result.scheduled_blocks:
                    # Invariant Check: Every persisted block must have valid, non-null timestamps with start < end
                    if b.start_time is None or b.end_time is None:
                        raise ValueError(
                            f"Cannot persist optimized block '{b.optimized_block_id}': "
                            f"start_time and end_time must not be NULL."
                        )
                    if b.start_time >= b.end_time:
                        raise ValueError(
                            f"Cannot persist optimized block '{b.optimized_block_id}': "
                            f"start_time ({b.start_time}) must be strictly before end_time ({b.end_time})."
                        )

                    block_type_str = "integrated" if b.is_integrated else "single"
                    departments_str = ",".join(b.departments_involved)

                    explanation_dict = {
                        "optimized_block_id": b.optimized_block_id,
                        "candidate_id": b.candidate_id,
                        "candidate_priority_value": b.priority_value,
                        "window_id": b.window_id,
                        "freight_impact": b.freight_impact,
                        "resource_status": b.resource_status,
                        "reasons": b.reasons,
                    }

                    block_record = OptimizedBlock(
                        optimization_run_id=run_record.id,
                        section_id=b.section_id,
                        block_start=b.start_time,
                        block_end=b.end_time,
                        block_duration_hrs=b.duration_hrs,
                        block_type=block_type_str,
                        is_integrated=b.is_integrated,
                        departments_involved=departments_str,
                        priority_score=b.realized_priority_value,
                        train_conflicts=b.train_conflict_count,
                        estimated_impact_score=b.compatibility_value,
                        explanation=json.dumps(explanation_dict),
                        status="Candidate",
                    )
                    db.add(block_record)
                    await db.flush()  # Populates block_record.id

                    # Persist junction tasks (verifying uniqueness within block)
                    seen_block_tasks: set[str] = set()
                    for tid in b.task_ids:
                        if tid not in seen_block_tasks:
                            seen_block_tasks.add(tid)
                            task_link = OptimizedBlockTask(
                                optimized_block_id=block_record.id,
                                task_id=tid,
                            )
                            db.add(task_link)

            await db.commit()
            await db.refresh(run_record)
            logger.info(
                "Persisted optimization run #%d (run_id: %s) with %d blocks",
                run_record.id,
                run_result.run_id,
                len(run_result.scheduled_blocks),
            )
            return run_record, run_result

        except Exception as e:
            await db.rollback()
            logger.error("Failed to persist optimization run %s: %s", run_result.run_id, e)
            raise

    @classmethod
    def compute_run_comparison(
        cls,
        base_run: OptimizationRun,
        scenario_run: OptimizationRun | None,
        base_blocks: list[OptimizedBlock],
        scenario_blocks: list[OptimizedBlock],
    ) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
        """Compute structured comparison metrics, task impact, and block differences."""
        # 1. Base metrics
        base_params = {}
        try:
            if base_run.parameters:
                base_params = json.loads(base_run.parameters)
        except Exception:
            pass

        base_metrics = base_params.get("metrics", {})
        base_tasks_sched = base_metrics.get("tasks_scheduled")
        if base_tasks_sched is None:
            base_tasks_sched = sum(len(getattr(b, "tasks", [])) for b in base_blocks)
        base_tasks_unassigned = base_metrics.get("tasks_unassigned", 0)
        base_blocks_count = len(base_blocks) or (base_metrics.get("separate_block_count", 0) + base_metrics.get("integrated_block_count", 0))
        base_integ_count = base_metrics.get("integrated_block_count", sum(1 for b in base_blocks if b.is_integrated))
        base_hours = base_metrics.get("estimated_total_block_hours")
        if base_hours is None:
            base_hours = float(sum((float(b.block_duration_hrs or 0.0) for b in base_blocks), 0.0))
        base_obj = float(base_run.objective_value or 0.0)

        # 2. Scenario metrics
        if scenario_run:
            scen_params = {}
            try:
                if scenario_run.parameters:
                    scen_params = json.loads(scenario_run.parameters)
            except Exception:
                pass

            scen_metrics = scen_params.get("metrics", {})
            scen_tasks_sched = scen_metrics.get("tasks_scheduled")
            if scen_tasks_sched is None:
                scen_tasks_sched = sum(len(getattr(b, "tasks", [])) for b in scenario_blocks)
            scen_tasks_unassigned = scen_metrics.get("tasks_unassigned", 0)
            scen_blocks_count = len(scenario_blocks) or (scen_metrics.get("separate_block_count", 0) + scen_metrics.get("integrated_block_count", 0))
            scen_integ_count = scen_metrics.get("integrated_block_count", sum(1 for b in scenario_blocks if b.is_integrated))
            scen_hours = scen_metrics.get("estimated_total_block_hours")
            if scen_hours is None:
                scen_hours = float(sum((float(b.block_duration_hrs or 0.0) for b in scenario_blocks), 0.0))
            scen_obj = float(scenario_run.objective_value or 0.0)
        else:
            scen_tasks_sched = 0
            scen_tasks_unassigned = 0
            scen_blocks_count = 0
            scen_integ_count = 0
            scen_hours = 0.0
            scen_obj = 0.0

        comparison_summary = {
            "tasks_scheduled": {
                "original": float(base_tasks_sched),
                "scenario": float(scen_tasks_sched),
                "delta": float(scen_tasks_sched - base_tasks_sched),
            },
            "tasks_unassigned": {
                "original": float(base_tasks_unassigned),
                "scenario": float(scen_tasks_unassigned),
                "delta": float(scen_tasks_unassigned - base_tasks_unassigned),
            },
            "block_count": {
                "original": float(base_blocks_count),
                "scenario": float(scen_blocks_count),
                "delta": float(scen_blocks_count - base_blocks_count),
            },
            "integrated_blocks": {
                "original": float(base_integ_count),
                "scenario": float(scen_integ_count),
                "delta": float(scen_integ_count - base_integ_count),
            },
            "estimated_total_block_hours": {
                "original": round(base_hours, 2),
                "scenario": round(scen_hours, 2),
                "delta": round(scen_hours - base_hours, 2),
            },
            "objective_value": {
                "original": round(base_obj, 2),
                "scenario": round(scen_obj, 2),
                "delta": round(scen_obj - base_obj, 2),
            },
        }

        # Deterministic explanation narrative
        if scenario_run and scenario_run.solver_status in ("OPTIMAL", "FEASIBLE"):
            task_delta = int(scen_tasks_sched - base_tasks_sched)
            block_delta = int(scen_blocks_count - base_blocks_count)
            integ_delta = int(scen_integ_count - base_integ_count)
            hours_delta = round(scen_hours - base_hours, 2)
            obj_delta = round(scen_obj - base_obj, 2)

            narrative_parts = [
                f"Under this scenario, the resulting optimization scheduled {scen_tasks_sched} tasks ({task_delta:+d} vs base run), "
                f"yielding {scen_blocks_count} total possession blocks ({block_delta:+d}) with an objective value of {scen_obj:.1f} ({obj_delta:+.1f})."
            ]
            if integ_delta != 0:
                word = "more" if integ_delta > 0 else "fewer"
                narrative_parts.append(
                    f"Cross-department consolidation resulted in {abs(integ_delta)} {word} integrated possession blocks."
                )
            if hours_delta != 0:
                word = "increased" if hours_delta > 0 else "decreased"
                narrative_parts.append(
                    f"Total corridor block duration {word} by {abs(hours_delta):.2f} hours."
                )
            if task_delta == 0 and block_delta == 0 and abs(obj_delta) < 0.01:
                narrative_parts.append(
                    "The specified assumption changes resulted in an equivalent operational block schedule."
                )
            explanation = " ".join(narrative_parts)
        elif scenario_run and scenario_run.solver_status == "INFEASIBLE":
            explanation = "No feasible plan was found under this scenario. The modified parameters violated hard constraints or horizon boundaries."
        else:
            explanation = "Scenario has not yet been solved or failed during execution."

        comparison_summary["explanation"] = explanation

        # 3. Task impact
        base_task_map: dict[str, tuple[str, str]] = {}
        for b in base_blocks:
            for t in getattr(b, "tasks", []):
                base_task_map[t.task_id] = (b.section_id or "", str(b.block_start or ""))

        scen_task_map: dict[str, tuple[str, str]] = {}
        for b in scenario_blocks:
            for t in getattr(b, "tasks", []):
                scen_task_map[t.task_id] = (b.section_id or "", str(b.block_start or ""))

        retained = sorted(list(set(base_task_map.keys()) & set(scen_task_map.keys())))
        newly_unassigned = sorted(list(set(base_task_map.keys()) - set(scen_task_map.keys())))
        newly_scheduled = sorted(list(set(scen_task_map.keys()) - set(base_task_map.keys())))
        changed_blocks = sorted([tid for tid in retained if base_task_map[tid] != scen_task_map[tid]])

        task_impact = {
            "retained_task_ids": retained,
            "newly_unassigned_task_ids": newly_unassigned,
            "newly_scheduled_task_ids": newly_scheduled,
            "changed_block_task_ids": changed_blocks,
        }

        # 4. Block differences
        base_keys = {(b.section_id, str(b.block_start), str(b.block_end)): b for b in base_blocks}
        scen_keys = {(b.section_id, str(b.block_start), str(b.block_end)): b for b in scenario_blocks}

        added = [b for k, b in scen_keys.items() if k not in base_keys]
        removed = [b for k, b in base_keys.items() if k not in scen_keys]
        retained_b = [b for k, b in scen_keys.items() if k in base_keys]

        block_differences = {
            "added_block_count": len(added),
            "removed_block_count": len(removed),
            "retained_block_count": len(retained_b),
            "added_blocks": added,
            "removed_blocks": removed,
            "retained_blocks": retained_b,
        }

        return comparison_summary, task_impact, block_differences

    @classmethod
    def assess_readiness(
        cls,
        block_id: int,
        block_start: datetime,
        block_end: datetime,
        duration_hrs: float,
        train_conflicts: int,
        resource_status: str = "VERIFIED",
        status: str = "Candidate",
    ) -> PossessionReadinessResponse:
        """Assess possession readiness deterministically for a proposed or alternative block."""
        checks: list[ReadinessCheck] = []
        duration = float(duration_hrs or 0.0)

        # 1. Possession window check
        if block_start >= block_end or duration <= 0:
            checks.append(
                ReadinessCheck(
                    key="window",
                    label="Possession window",
                    status="FAIL",
                    message="The proposed block has an invalid or zero-length possession window.",
                )
            )
        elif duration > 8.0:
            checks.append(
                ReadinessCheck(
                    key="window",
                    label="Possession window",
                    status="FAIL",
                    message=f"Block duration is {duration:.2f} hours, exceeding the prototype safety limit of 8 hours.",
                )
            )
        else:
            checks.append(
                ReadinessCheck(
                    key="window",
                    label="Possession window",
                    status="PASS",
                    message=f"Proposed window is valid for {duration:.2f} hours.",
                )
            )

        # 2. Train conflict check
        conflicts = train_conflicts or 0
        if conflicts > 0:
            checks.append(
                ReadinessCheck(
                    key="train_conflicts",
                    label="Train conflict check",
                    status="PENDING",
                    message=f"{conflicts} train conflict(s) remain associated with this proposed block.",
                )
            )
        else:
            checks.append(
                ReadinessCheck(
                    key="train_conflicts",
                    label="Train conflict check",
                    status="PASS",
                    message="No train conflicts are recorded for this proposed block.",
                )
            )

        # 3. Resource readiness
        res_val = str(resource_status or "UNVERIFIED").upper()
        if res_val in {"AVAILABLE", "READY", "VERIFIED"}:
            checks.append(
                ReadinessCheck(
                    key="resources",
                    label="Resource readiness",
                    status="PASS",
                    message="Required resources are marked as ready/verified.",
                )
            )
        else:
            checks.append(
                ReadinessCheck(
                    key="resources",
                    label="Resource readiness",
                    status="PENDING",
                    message="Resource readiness is not verified in the current prototype data.",
                )
            )

        # 4. Block status
        b_status = (status or "Candidate").upper()
        if b_status == "REJECTED":
            checks.append(
                ReadinessCheck(
                    key="block_status",
                    label="Block status",
                    status="FAIL",
                    message="This proposed block has been rejected.",
                )
            )
        else:
            checks.append(
                ReadinessCheck(
                    key="block_status",
                    label="Block status",
                    status="PASS",
                    message=f"Block is currently in '{status or 'Candidate'}' status.",
                )
            )

        failed = [c for c in checks if c.status == "FAIL"]
        pending = [c for c in checks if c.status == "PENDING"]

        if failed:
            readiness = "REDUCE"
            summary = "The proposed block requires scope reduction or correction before operational review."
        elif pending:
            readiness = "HOLD"
            summary = "The proposed block has unresolved readiness items and should remain on hold."
        else:
            readiness = "GO"
            summary = "All prototype readiness checks pass. Final possession approval remains a human decision."

        return PossessionReadinessResponse(
            block_id=block_id,
            readiness=readiness,
            summary=summary,
            checks=checks,
            human_decision_required=True,
        )

    @classmethod
    async def evaluate_block_counterfactual(
        cls,
        db: AsyncSession,
        target_block_id: int,
        scenario_type: str,
        postpone_hours: float | None = None,
        new_start: datetime | None = None,
        new_end: datetime | None = None,
        new_duration_hrs: float | None = None,
        new_task_ids: list[str] | None = None,
        new_departments: list[str] | None = None,
        notes: str | None = None,
    ) -> CounterfactualComparison:
        """Evaluate a realistic counterfactual alternative for a specific optimized block."""
        # 1. Load baseline block
        stmt = (
            select(OptimizedBlock)
            .options(selectinload(OptimizedBlock.tasks))
            .where(OptimizedBlock.id == target_block_id)
        )
        base_block = (await db.scalars(stmt)).first()
        if not base_block:
            raise ValueError(f"Optimized block '{target_block_id}' not found.")

        # 2. Extract baseline properties
        base_start = base_block.block_start
        base_end = base_block.block_end
        base_duration = float(base_block.block_duration_hrs or 0.0)
        base_tasks = [t.task_id for t in base_block.tasks] if base_block.tasks else []
        base_depts = (
            [d.strip() for d in base_block.departments_involved.split(",") if d.strip()]
            if base_block.departments_involved
            else []
        )
        base_priority = float(base_block.priority_score or 0.0)
        base_conflicts = int(base_block.train_conflicts or 0)
        base_impact = float(base_block.estimated_impact_score or 0.0)

        resource_val = "VERIFIED"
        opt_id_label = f"OPT-BLK-{base_block.id:04d}"
        if base_block.explanation:
            try:
                expl = json.loads(base_block.explanation)
                opt_id_label = expl.get("optimized_block_id", opt_id_label)
                resource_val = expl.get("resource_status", "VERIFIED")
            except Exception:
                pass

        base_readiness = cls.assess_readiness(
            block_id=base_block.id,
            block_start=base_start,
            block_end=base_end,
            duration_hrs=base_duration,
            train_conflicts=base_conflicts,
            resource_status=resource_val,
            status=base_block.status or "Candidate",
        )

        baseline_data = CounterfactualBlockData(
            block_id=base_block.id,
            optimized_block_id=opt_id_label,
            section_id=base_block.section_id or "UNKNOWN",
            block_start=base_start,
            block_end=base_end,
            duration_hrs=base_duration,
            is_integrated=base_block.is_integrated or (len(base_depts) > 1),
            departments=base_depts,
            task_ids=base_tasks,
            priority_score=base_priority,
            train_conflicts=base_conflicts,
            conflict_trains=[],
            estimated_impact_score=base_impact,
            readiness=base_readiness,
        )

        # 3. Compute alternative parameters
        st = (scenario_type or "").upper()
        if st in ("POSTPONE", "POSTPONE_BLOCK"):
            shift_hrs = float(postpone_hours) if postpone_hours is not None else 0.0
            if shift_hrs > 0.0:
                alt_start = base_start + timedelta(hours=shift_hrs)
                alt_end = base_end + timedelta(hours=shift_hrs)
                alt_duration = base_duration
            elif new_start is not None:
                alt_start = new_start
                alt_end = new_end or (new_start + timedelta(hours=base_duration))
                alt_duration = round((alt_end - alt_start).total_seconds() / 3600.0, 2)
            else:
                alt_start = base_start
                alt_end = base_end
                alt_duration = base_duration
            alt_tasks = list(base_tasks)
            alt_depts = list(base_depts)
            alt_priority = base_priority

        elif st in ("REDUCE_DURATION", "REDUCE"):
            alt_duration = float(new_duration_hrs) if new_duration_hrs is not None else max(1.0, base_duration - 1.0)
            alt_start = base_start
            alt_end = base_start + timedelta(hours=alt_duration)
            alt_tasks = list(base_tasks)
            alt_depts = list(base_depts)
            alt_priority = base_priority

        elif st in ("MOVE_WINDOW", "MOVE"):
            if new_start is not None and new_end is not None:
                alt_start = new_start
                alt_end = new_end
                alt_duration = round((new_end - new_start).total_seconds() / 3600.0, 2)
            else:
                alt_start = base_start
                alt_end = base_end
                alt_duration = base_duration
            alt_tasks = list(base_tasks)
            alt_depts = list(base_depts)
            alt_priority = base_priority

        elif st in ("CHANGE_TASKS_DEPT", "CHANGE_TASKS"):
            alt_start = base_start
            alt_end = base_end
            alt_duration = base_duration
            alt_tasks = list(new_task_ids) if new_task_ids is not None else list(base_tasks)
            alt_depts = list(new_departments) if new_departments is not None else list(base_depts)

            # Recompute priority from authentic MaintenanceTask records
            if alt_tasks:
                stmt_tasks = (
                    select(MaintenanceTask)
                    .options(selectinload(MaintenanceTask.asset))
                    .where(MaintenanceTask.task_id.in_(alt_tasks))
                )
                db_tasks = (await db.scalars(stmt_tasks)).all()
                total_p = 0.0
                for t in db_tasks:
                    crit = t.asset.criticality_index if t.asset else None
                    risk = t.asset.failure_risk_score if t.asset else None
                    p_res = compute_priority(
                        task_id=t.task_id,
                        department=t.department,
                        severity=t.severity,
                        days_overdue=t.days_overdue,
                        asset_id=t.asset_id,
                        section_id=t.section_id,
                        criticality_index=crit,
                        failure_risk_score=risk,
                        baseline_priority_score=t.priority_score,
                    )
                    total_p += p_res.computed_priority_score
                alt_priority = round(total_p, 2)
            else:
                alt_priority = 0.0
        else:
            alt_start = base_start
            alt_end = base_end
            alt_duration = base_duration
            alt_tasks = list(base_tasks)
            alt_depts = list(base_depts)
            alt_priority = base_priority

        # 4. Check train timetable conflicts on the alternative time window
        stmt_occs = select(TrainSectionOccupancy).where(
            TrainSectionOccupancy.section_id == base_block.section_id
        )
        sec_occs = (await db.scalars(stmt_occs)).all()
        has_conf, conf_count, conf_trains = check_train_conflicts(
            alt_start, alt_end, sec_occs
        )

        # 5. Evaluate alternative readiness
        alt_readiness = cls.assess_readiness(
            block_id=base_block.id,
            block_start=alt_start,
            block_end=alt_end,
            duration_hrs=alt_duration,
            train_conflicts=conf_count,
            resource_status=resource_val,
            status="Candidate",
        )

        # 6. Operational impact score calculation
        alt_is_integrated = len(alt_depts) > 1
        alt_impact = round(max(0.0, min(100.0, 100.0 - (conf_count * 25.0) + (15.0 if alt_is_integrated else 0.0))), 1)

        alternative_data = CounterfactualBlockData(
            block_id=base_block.id,
            optimized_block_id=opt_id_label,
            section_id=base_block.section_id or "UNKNOWN",
            block_start=alt_start,
            block_end=alt_end,
            duration_hrs=alt_duration,
            is_integrated=alt_is_integrated,
            departments=alt_depts,
            task_ids=alt_tasks,
            priority_score=alt_priority,
            train_conflicts=conf_count,
            conflict_trains=conf_trains,
            estimated_impact_score=alt_impact,
            readiness=alt_readiness,
        )

        # 7. Compute deltas
        dur_delta = round(alt_duration - base_duration, 2)
        prio_delta = round(alt_priority - base_priority, 2)
        conf_delta = conf_count - base_conflicts
        imp_delta = round(alt_impact - base_impact, 2)
        tasks_added = [tid for tid in alt_tasks if tid not in base_tasks]
        tasks_removed = [tid for tid in base_tasks if tid not in alt_tasks]

        readiness_order = {"FAIL": 0, "REDUCE": 1, "HOLD": 2, "GO": 3}
        base_read_score = readiness_order.get(base_readiness.readiness, 1)
        alt_read_score = readiness_order.get(alt_readiness.readiness, 1)
        readiness_change = "IMPROVED" if alt_read_score > base_read_score else ("DEGRADED" if alt_read_score < base_read_score else "UNCHANGED")

        # 8. Determine overall rating (BETTER / WORSE / NEUTRAL)
        if conf_delta < 0 and prio_delta >= 0 and alt_duration <= 8.0 and alt_read_score >= base_read_score:
            rating = "BETTER"
        elif alt_read_score > base_read_score and prio_delta >= -5.0:
            rating = "BETTER"
        elif prio_delta > 5.0 and conf_delta <= 0:
            rating = "BETTER"
        elif conf_delta > 0 or prio_delta < -10.0 or alt_duration > 8.0 or alt_read_score < base_read_score:
            rating = "WORSE"
        else:
            rating = "NEUTRAL"

        # 9. Natural language deterministic explanation
        if st in ("POSTPONE", "POSTPONE_BLOCK"):
            shift_val = postpone_hours if postpone_hours is not None else ((alt_start - base_start).total_seconds() / 3600.0)
            explanation = (
                f"Postponing block {opt_id_label} by {shift_val:.1f}h shifts the window to "
                f"{alt_start.strftime('%Y-%m-%d %H:%M')}–{alt_end.strftime('%H:%M')} UTC. "
                f"Train conflicts change by {conf_delta:+d} (from {base_conflicts} to {conf_count}). "
                f"Priority delivered remains {alt_priority:.1f} across {len(alt_tasks)} tasks. "
                f"Possession readiness evaluates to {alt_readiness.readiness} ({readiness_change.lower()})."
            )
        elif st in ("REDUCE_DURATION", "REDUCE"):
            explanation = (
                f"Reducing block duration from {base_duration:.2f}h to {alt_duration:.2f}h ({dur_delta:+.2f}h) "
                f"frees corridor capacity while scheduling {len(alt_tasks)} tasks. "
                f"Train conflicts evaluate to {conf_count} ({conf_delta:+d}). "
                f"Priority delivered is {alt_priority:.1f}. Readiness status is {alt_readiness.readiness}."
            )
        elif st in ("MOVE_WINDOW", "MOVE"):
            explanation = (
                f"Moving block {opt_id_label} to alternative window {alt_start.strftime('%Y-%m-%d %H:%M')}–{alt_end.strftime('%H:%M')} UTC "
                f"({alt_duration:.2f}h) results in {conf_count} train conflicts ({conf_delta:+d} vs baseline). "
                f"Priority delivered is {alt_priority:.1f} with readiness {alt_readiness.readiness}."
            )
        elif st in ("CHANGE_TASKS_DEPT", "CHANGE_TASKS"):
            explanation = (
                f"Modifying task composition schedules {len(alt_tasks)} tasks ({len(tasks_added)} added, {len(tasks_removed)} removed), "
                f"shifting realized priority by {prio_delta:+.1f} points (from {base_priority:.1f} to {alt_priority:.1f}). "
                f"Train conflicts are {conf_count}. Readiness evaluates to {alt_readiness.readiness}."
            )
        else:
            explanation = (
                f"Evaluating alternative scenario on block {opt_id_label}: "
                f"duration={alt_duration:.2f}h ({dur_delta:+.2f}h), priority={alt_priority:.1f} ({prio_delta:+.1f}), "
                f"conflicts={conf_count} ({conf_delta:+d}), readiness={alt_readiness.readiness}."
            )

        deltas_dict = {
            "duration_delta": dur_delta,
            "priority_delta": prio_delta,
            "train_conflicts_delta": conf_delta,
            "estimated_impact_delta": imp_delta,
            "tasks_added": tasks_added,
            "tasks_removed": tasks_removed,
            "readiness_change": readiness_change,
        }

        return CounterfactualComparison(
            target_block_id=target_block_id,
            scenario_type=scenario_type,
            rating=rating,
            explanation=explanation,
            baseline=baseline_data,
            alternative=alternative_data,
            deltas=deltas_dict,
        )
