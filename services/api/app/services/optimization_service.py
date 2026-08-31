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

from datetime import datetime
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
from app.models.optimization import (
    OptimizationRun,
    OptimizedBlock,
    OptimizedBlockTask,
)
from app.services.candidate_block_engine import CandidateBlockEngine
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
            # Duration on OptimizationTask is informative; candidate blocks carry required_duration_hrs
            dur = float(t.required_duration_hrs) if t.required_duration_hrs is not None else 2.0
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
