"""In-Memory OR-Tools CP-SAT Solver Core for Railway Maintenance Block Optimization (Batch 6B.1).

=============================================================================
DISCLAIMER & PURPOSE:
This module implements the mathematical optimization solver core using
Google OR-Tools CP-SAT (Constraint Programming - Satisfiability).

It operates purely IN-MEMORY, consuming domain-level contracts
(OptimizationTask, OptimizationCandidate, ObjectiveWeights, HardConstraintConfig)
and producing an OptimizationRunResult.

It does NOT perform database writes and does NOT conflate solver optimality
with railway engineering or business approval.
=============================================================================

Pipeline Architecture:
5A: Maintenance Priority
      ↓
5B: Compatibility & Integrated Opportunities
      ↓
5C: Candidate Block Generation
      ↓
6A: Optimization Domain Contracts
      ↓
6B.1: OR-Tools CP-SAT Solver Core (This Module)
"""

from __future__ import annotations

from datetime import datetime, timezone
import logging
import time
from typing import Any
import uuid

from ortools.sat.python import cp_model

from app.domain.candidate import OptimizationCandidate
from app.domain.constraints import HardConstraintConfig
from app.domain.objectives import ObjectiveWeights
from app.domain.results import (
    OptimizationRunResult,
    OptimizedBlockDomain,
    SolverStatus,
)
from app.domain.task import OptimizationTask

logger = logging.getLogger(__name__)

# Scaling factor to maintain exact integer arithmetic in CP-SAT objective
OBJECTIVE_SCALE = 1000


def check_candidate_overlap(c1: OptimizationCandidate, c2: OptimizationCandidate) -> bool:
    """Check whether two candidates on the same section overlap temporally."""
    if c1.section_id != c2.section_id:
        return False
    return c1.candidate_start < c2.candidate_end and c1.candidate_end > c2.candidate_start


def build_selectable_candidates(
    candidates: list[OptimizationCandidate],
    hard_constraints: HardConstraintConfig,
    planning_start: datetime,
    planning_end: datetime,
) -> tuple[list[OptimizationCandidate], list[str]]:
    """Filter candidates against hard constraints and planning horizon prior to variable construction."""
    selectable: list[OptimizationCandidate] = []
    pruning_warnings: list[str] = []

    for c in candidates:
        # 1. Feasibility status constraint
        if hard_constraints.require_candidate_feasible and c.computed_feasibility_status != "FEASIBLE":
            pruning_warnings.append(
                f"Candidate '{c.candidate_id}' pruned: feasibility status is '{c.computed_feasibility_status}'"
            )
            continue

        # 2. Train conflict constraint
        if not hard_constraints.allow_train_conflict and c.train_conflict:
            pruning_warnings.append(
                f"Candidate '{c.candidate_id}' pruned: train occupancy conflict detected"
            )
            continue

        # 3. Resource feasibility constraint
        if hard_constraints.require_resource_feasibility and c.resource_check != "VERIFIED":
            pruning_warnings.append(
                f"Candidate '{c.candidate_id}' pruned: resource availability is '{c.resource_check}'"
            )
            continue

        # 4. Max tasks per block constraint
        if len(c.task_ids) > hard_constraints.max_tasks_per_block:
            pruning_warnings.append(
                f"Candidate '{c.candidate_id}' pruned: task count ({len(c.task_ids)}) exceeds max ({hard_constraints.max_tasks_per_block})"
            )
            continue

        # 5. Max block duration constraint
        if c.required_duration_hrs > hard_constraints.max_block_duration_hrs:
            pruning_warnings.append(
                f"Candidate '{c.candidate_id}' pruned: duration ({c.required_duration_hrs}h) exceeds max ({hard_constraints.max_block_duration_hrs}h)"
            )
            continue

        # 6. Planning horizon constraint (fully-contained policy)
        if c.candidate_start < planning_start or c.candidate_end > planning_end:
            pruning_warnings.append(
                f"Candidate '{c.candidate_id}' pruned: outside planning horizon [{planning_start.isoformat()}, {planning_end.isoformat()}]"
            )
            continue

        selectable.append(c)

    return selectable, pruning_warnings


class CPSATSolver:
    """In-memory CP-SAT solver for maintenance block planning."""

    @classmethod
    def solve(
        cls,
        tasks: list[OptimizationTask],
        candidates: list[OptimizationCandidate],
        weights: ObjectiveWeights | None = None,
        hard_constraints: HardConstraintConfig | None = None,
        planning_start: datetime | None = None,
        planning_end: datetime | None = None,
        time_limit_seconds: float = 10.0,
        random_seed: int = 42,
        run_id: str | None = None,
    ) -> OptimizationRunResult:
        """Execute CP-SAT optimization to schedule maintenance tasks into candidate blocks."""
        start_wall_time = time.perf_counter()
        actual_run_id = run_id or f"RUN-{uuid.uuid4().hex[:8].upper()}"
        weights = weights or ObjectiveWeights()
        hard_constraints = hard_constraints or HardConstraintConfig()

        # Derive planning horizon if not provided
        if not planning_start or not planning_end:
            if candidates:
                planning_start = min(c.candidate_start for c in candidates)
                planning_end = max(c.candidate_end for c in candidates)
            else:
                now = datetime.now(timezone.utc)
                planning_start = now
                planning_end = now

        # 1. Prune infeasible candidates based on hard constraints and planning horizon
        selectable_candidates, warnings = build_selectable_candidates(
            candidates, hard_constraints, planning_start, planning_end
        )

        # Build task mapping
        task_map = {t.task_id: t for t in tasks}

        # Initialize CP-SAT Model
        model = cp_model.CpModel()

        # 2. Decision Variables
        # x[c_id]: 1 if candidate c is selected, 0 otherwise
        cand_vars: dict[str, cp_model.IntVar] = {}
        for c in selectable_candidates:
            cand_vars[c.candidate_id] = model.NewBoolVar(f"cand_{c.candidate_id}")

        # y[t_id]: 1 if task t is scheduled, 0 otherwise
        task_vars: dict[str, cp_model.IntVar] = {}
        for t in tasks:
            task_vars[t.task_id] = model.NewBoolVar(f"task_{t.task_id}")

        # 3. Hard Constraints

        # A. Task Single Assignment & Linking Constraint:
        # Each physical maintenance task can be assigned to AT MOST ONE scheduled block.
        # y[t] == sum_{c in candidates(t)} x[c]
        if not hard_constraints.enforce_single_assignment_per_task:
            warnings.append(
                "enforce_single_assignment_per_task=False requested, but multi-execution of physical tasks is unsupported; enforcing single assignment."
            )

        for t in tasks:
            covering_cands = [
                cand_vars[c.candidate_id]
                for c in selectable_candidates
                if t.task_id in c.task_ids
            ]
            if covering_cands:
                model.Add(sum(covering_cands) <= 1)
                model.Add(task_vars[t.task_id] == sum(covering_cands))
            else:
                model.Add(task_vars[t.task_id] == 0)

        # B. Section-Time Spatial/Temporal Mutex Constraint:
        # If two selected candidates overlap in time on the same railway section,
        # they cannot both be scheduled simultaneously.
        # Group candidates by section to minimize pair comparisons
        sec_cands: dict[str, list[OptimizationCandidate]] = {}
        for c in selectable_candidates:
            sec_cands.setdefault(c.section_id, []).append(c)

        for sec_id, c_list in sec_cands.items():
            n = len(c_list)
            for i in range(n):
                for j in range(i + 1, n):
                    c1, c2 = c_list[i], c_list[j]
                    if check_candidate_overlap(c1, c2):
                        model.Add(cand_vars[c1.candidate_id] + cand_vars[c2.candidate_id] <= 1)

        # 4. Objective Function Formulation
        objective_terms = []

        # A. Candidate-level contributions & penalties
        for c in selectable_candidates:
            c_var = cand_vars[c.candidate_id]

            # 1. Priority delivered (Sum of task priorities or candidate priority score)
            c_prio = sum(task_map[t_id].priority_score for t_id in c.task_ids if t_id in task_map)
            if c_prio == 0.0:
                c_prio = c.priority_score
            prio_coeff = int(round(weights.weight_priority_score * c_prio * OBJECTIVE_SCALE))

            # 2. Integrated task synergy bonus (multi-task / multi-department co-location)
            synergy_coeff = 0
            if len(c.task_ids) > 1:
                mult = len(c.task_ids) - 1
                synergy_coeff = int(
                    round(weights.weight_integrated_task_bonus * c.compatibility_score * mult * OBJECTIVE_SCALE)
                )

            # 3. Overdue backlog mitigation bonus
            overdue_sum = 0.0
            for t_id in c.task_ids:
                if t_id in task_map:
                    t_overdue = task_map[t_id].days_overdue or 0
                    norm_overdue = min(100.0, (t_overdue / 30.0) * 100.0)
                    overdue_sum += norm_overdue
            overdue_coeff = int(round(weights.weight_overdue_mitigation * overdue_sum * OBJECTIVE_SCALE))

            # 4. Block count penalty (minimizes unnecessary schedule fragmentation)
            block_penalty_coeff = int(round(weights.weight_total_block_count * 50.0 * OBJECTIVE_SCALE))

            # 5. Unused window slack penalty (penalizes idle track buffer waste)
            slack_hrs = max(0.0, c.window_duration_hrs - c.required_duration_hrs)
            slack_penalty_coeff = int(round(weights.weight_unused_window_time * slack_hrs * 20.0 * OBJECTIVE_SCALE))

            # 6. Train disruption penalty (only active if train conflicts are allowed)
            train_penalty_coeff = 0
            if hard_constraints.allow_train_conflict and c.train_conflict:
                train_penalty_coeff = int(
                    round(weights.weight_train_disruption * c.train_conflict_count * 100.0 * OBJECTIVE_SCALE)
                )

            # 7. Freight impact penalty
            freight_penalty_coeff = 0
            if c.freight_data_available and c.freight_level:
                f_lvl = c.freight_level.upper()
                if f_lvl == "HIGH":
                    freight_penalty_coeff = int(round(weights.weight_freight_impact * 100.0 * OBJECTIVE_SCALE))
                elif f_lvl == "MEDIUM":
                    freight_penalty_coeff = int(round(weights.weight_freight_impact * 40.0 * OBJECTIVE_SCALE))

            net_cand_coeff = (
                prio_coeff
                + synergy_coeff
                + overdue_coeff
                - block_penalty_coeff
                - slack_penalty_coeff
                - train_penalty_coeff
                - freight_penalty_coeff
            )
            objective_terms.append(net_cand_coeff * c_var)

        # B. Task-level count maximization bonus
        for t in tasks:
            task_bonus_coeff = int(round(weights.weight_tasks_scheduled * 100.0 * OBJECTIVE_SCALE))
            objective_terms.append(task_bonus_coeff * task_vars[t.task_id])

        # Maximize the total composite weighted objective
        model.Maximize(sum(objective_terms) if objective_terms else 0)

        # 5. Solver Configuration
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = float(time_limit_seconds)
        solver.parameters.random_seed = int(random_seed)
        solver.parameters.num_search_workers = 4

        # Execute Solve
        raw_status = solver.Solve(model)
        elapsed_seconds = round(time.perf_counter() - start_wall_time, 4)

        # 6. Map Solver Status
        if raw_status == cp_model.OPTIMAL:
            solver_status = SolverStatus.OPTIMAL
        elif raw_status == cp_model.FEASIBLE:
            solver_status = SolverStatus.FEASIBLE
        elif raw_status == cp_model.INFEASIBLE:
            solver_status = SolverStatus.INFEASIBLE
            warnings.append("Solver proved model is INFEASIBLE: no feasible candidate schedule exists.")
        else:
            solver_status = SolverStatus.UNKNOWN
            warnings.append(f"Solver terminated with non-conclusive status ({raw_status}).")

        # 7. Extract Results
        scheduled_blocks: list[OptimizedBlockDomain] = []
        scheduled_task_ids: set[str] = set()

        if solver_status in (SolverStatus.OPTIMAL, SolverStatus.FEASIBLE):
            for c in selectable_candidates:
                if solver.Value(cand_vars[c.candidate_id]) == 1:
                    is_integrated = len(c.task_ids) > 1 or len(c.departments_involved) > 1
                    opt_block = OptimizedBlockDomain(
                        optimized_block_id=f"OPT-{c.candidate_id}",
                        section_id=c.section_id,
                        window_id=c.window_id,
                        candidate_id=c.candidate_id,
                        start_time=c.candidate_start,
                        end_time=c.candidate_end,
                        duration_hrs=c.required_duration_hrs,
                        task_ids=c.task_ids,
                        departments_involved=c.departments_involved,
                        is_integrated=is_integrated,
                        train_conflict_count=c.train_conflict_count,
                        freight_impact=c.freight_level,
                        resource_status=c.resource_check,
                        priority_value=c.priority_score,
                        compatibility_value=c.compatibility_score,
                        reasons=c.reasons,
                    )
                    scheduled_blocks.append(opt_block)
                    scheduled_task_ids.update(c.task_ids)

        unassigned_task_ids = [t.task_id for t in tasks if t.task_id not in scheduled_task_ids]

        tasks_considered = len(tasks)
        tasks_scheduled = len(scheduled_task_ids)
        tasks_unassigned = len(unassigned_task_ids)
        integrated_count = sum(1 for b in scheduled_blocks if b.is_integrated)
        separate_count = len(scheduled_blocks) - integrated_count
        total_block_hours = round(sum(b.duration_hrs for b in scheduled_blocks), 2)
        raw_obj = solver.ObjectiveValue() if solver_status in (SolverStatus.OPTIMAL, SolverStatus.FEASIBLE) else None
        objective_value = round(raw_obj / OBJECTIVE_SCALE, 2) if raw_obj is not None else None

        return OptimizationRunResult(
            run_id=actual_run_id,
            planning_start=planning_start,
            planning_end=planning_end,
            solver_status=solver_status,
            objective_value=objective_value,
            scheduled_blocks=scheduled_blocks,
            unassigned_tasks=unassigned_task_ids,
            tasks_considered=tasks_considered,
            tasks_scheduled=tasks_scheduled,
            tasks_unassigned=tasks_unassigned,
            integrated_block_count=integrated_count,
            separate_block_count=separate_count,
            estimated_total_block_hours=total_block_hours,
            solver_runtime_seconds=elapsed_seconds,
            warnings=warnings,
        )
