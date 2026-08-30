"""Deterministic Maintenance Task Compatibility and Integrated-Block Opportunity Engine.

=============================================================================
DISCLAIMER & PURPOSE:
This module implements an OPPORTUNITY DETECTION LAYER for identifying
maintenance tasks that can potentially be combined into integrated railway
maintenance blocks (e.g., Engineering + S&T + TRD).

It does NOT perform global block scheduling, candidate corridor window selection,
or OR-Tools optimization. All calculations are deterministic, bounded, and explainable.
=============================================================================

Compatibility Dimensions:
1. Spatial Compatibility:
   Tasks must be on the same section (section_id) to share track possession protection.
2. Department Integration:
   Detects cross-department combinations (Engineering, S&T, TRD) to reduce separate blocks.
3. Duration Feasibility:
   Calculates combined duration assuming parallel execution with safety coordination overhead:
   combined_duration_hrs = round(max(durations) + 0.15 * (sum(durations) - max(durations)), 2)
4. Temporal Compatibility:
   Evaluates active task status and overdue proximity for scheduling compatibility.
5. Resource Compatibility:
   Cross-department tasks utilize independent crews/gangs, eliminating internal depot conflict.

Composite Compatibility Score:
   Score = round(0.40 * spatial + 0.25 * duration + 0.20 * temporal + 0.15 * resource, 2)
   Bounded to [0.0, 100.0]
   - COMPATIBLE: score >= 75.0
   - PARTIALLY_COMPATIBLE: 50.0 <= score < 75.0
   - INCOMPATIBLE: score < 50.0 or spatial mismatch (0.0)

Task Group Size:
   Bounded to 2 or 3 tasks per integrated block opportunity.
"""

from __future__ import annotations

from dataclasses import dataclass
import itertools
import logging
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.asset import Asset, MaintenanceTask
from app.schemas.compatibility import (
    DEFAULT_ADVISORY_NOTE,
    IntegrationOpportunityResponse,
    PrioritySummary,
)
from app.services.priority_engine import compute_priority

logger = logging.getLogger(__name__)

# Maximum group size for this batch
MAX_GROUP_SIZE = 3
MIN_GROUP_SIZE = 2

# Duration threshold constants
DURATION_EXCELLENT_LIMIT = 4.0   # <= 4 hrs: 100 score
DURATION_GOOD_LIMIT = 6.0        # <= 6 hrs: 85 score
DURATION_ACCEPTABLE_LIMIT = 8.0  # <= 8 hrs: 60 score


@dataclass
class TaskProfile:
    """Lightweight domain representation of a task with evaluated priority."""

    task_id: str
    section_id: str
    department: str
    severity: str | None
    days_overdue: int
    required_duration_hrs: float
    status: str
    computed_priority_score: float
    asset_id: str | None


def calculate_combined_duration(durations: list[float]) -> float:
    """Calculate combined execution duration for parallel/shadow maintenance block.

    Multiple departments work concurrently in the shared block window.
    Total block time equals the maximum duration plus 15% coordination overhead
    for subsidiary tasks.
    """
    if not durations:
        return 0.0
    max_d = max(durations)
    sum_d = sum(durations)
    overhead = 0.15 * (sum_d - max_d)
    return round(max_d + overhead, 2)


def evaluate_group_compatibility(tasks: list[TaskProfile]) -> IntegrationOpportunityResponse:
    """Evaluate compatibility dimensions and composite score for a group of 2 or 3 tasks."""
    if len(tasks) < MIN_GROUP_SIZE or len(tasks) > MAX_GROUP_SIZE:
        raise ValueError(f"Task group size must be between {MIN_GROUP_SIZE} and {MAX_GROUP_SIZE}, got {len(tasks)}")

    # Check for duplicate task IDs
    task_ids = [t.task_id for t in tasks]
    if len(set(task_ids)) != len(task_ids):
        raise ValueError(f"Duplicate tasks in group: {task_ids}")

    sorted_tasks = sorted(tasks, key=lambda t: t.task_id)
    sorted_task_ids = [t.task_id for t in sorted_tasks]

    # 1. Spatial Compatibility (Mandatory same section)
    sections = set(t.section_id for t in tasks)
    is_same_section = len(sections) == 1
    section_id = sorted_tasks[0].section_id

    if is_same_section and section_id:
        spatial_score = 100.0
        spatial_status = "COMPATIBLE"
    else:
        spatial_score = 0.0
        spatial_status = "INCOMPATIBLE"

    # 2. Department Analysis
    departments = sorted(list(set(t.department for t in tasks)))
    is_cross_dept = len(departments) > 1

    # 3. Duration Compatibility
    durations = [t.required_duration_hrs for t in tasks]
    combined_dur = calculate_combined_duration(durations)

    if combined_dur <= DURATION_EXCELLENT_LIMIT:
        duration_score = 100.0
        duration_status = "COMPATIBLE"
    elif combined_dur <= DURATION_GOOD_LIMIT:
        duration_score = 85.0
        duration_status = "COMPATIBLE"
    elif combined_dur <= DURATION_ACCEPTABLE_LIMIT:
        duration_score = 60.0
        duration_status = "PARTIALLY_COMPATIBLE"
    else:
        duration_score = 30.0
        duration_status = "INCOMPATIBLE"

    # 4. Temporal Compatibility
    # This measures overdue-urgency proximity between tasks only. It does NOT
    # check corridor window availability or real schedule/time-slot overlap,
    # which are handled by later batches.
    active_statuses = {"OPEN", "INPROGRESS", "PENDING"}
    all_active = all(t.status.upper() in active_statuses for t in tasks)
    overdues = [t.days_overdue for t in tasks]
    overdue_spread = max(overdues) - min(overdues) if overdues else 0

    if all_active and overdue_spread <= 15:
        temporal_score = 100.0
        temporal_status = "COMPATIBLE"
    elif all_active and overdue_spread <= 30:
        temporal_score = 75.0
        temporal_status = "COMPATIBLE"
    elif all_active:
        temporal_score = 55.0
        temporal_status = "PARTIALLY_COMPATIBLE"
    else:
        temporal_score = 25.0
        temporal_status = "INCOMPATIBLE"

    # 5. Resource Compatibility
    # This is a department-diversity proxy only. It does NOT query the
    # Resource or ResourceAvailability tables and does NOT verify actual crew
    # or equipment availability or conflicts.
    if is_cross_dept:
        resource_score = 100.0
        resource_status = "COMPATIBLE"
    else:
        resource_score = 75.0
        resource_status = "PARTIALLY_COMPATIBLE"

    # Composite Compatibility Calculation
    if spatial_score == 0.0:
        composite_score = 0.0
        compatibility_status = "INCOMPATIBLE"
    else:
        raw_score = (
            0.40 * spatial_score
            + 0.25 * duration_score
            + 0.20 * temporal_score
            + 0.15 * resource_score
        )
        composite_score = round(min(100.0, max(0.0, raw_score)), 2)
        if composite_score >= 75.0:
            compatibility_status = "COMPATIBLE"
        elif composite_score >= 50.0:
            compatibility_status = "PARTIALLY_COMPATIBLE"
        else:
            compatibility_status = "INCOMPATIBLE"

    # Priority Summary
    priorities = [t.computed_priority_score for t in tasks]
    highest_priority = round(max(priorities), 2)
    average_priority = round(sum(priorities) / len(priorities), 2)
    total_priority = round(sum(priorities), 2)

    priority_summary = PrioritySummary(
        highest_task_priority=highest_priority,
        average_task_priority=average_priority,
        total_priority_value=total_priority,
    )

    # Explainability Reasons
    reasons: list[str] = []
    if is_same_section:
        reasons.append(f"All {len(tasks)} tasks are located on operational section '{section_id}'")
    else:
        reasons.append(f"Tasks span different sections ({', '.join(sections)})")

    if is_cross_dept:
        reasons.append(f"Integrated cross-department opportunity involving {len(departments)} departments ({', '.join(departments)})")
    else:
        reasons.append(f"Single-department batch for '{departments[0]}'")

    reasons.append(f"Estimated combined block duration is {combined_dur:.2f} hrs (longest task: {max(durations):.2f} hrs)")

    if highest_priority >= 70.0:
        reasons.append(f"High-priority work included (highest task score: {highest_priority:.2f})")

    opp_id = f"OPP-{section_id}-{'-'.join(sorted_task_ids)}"

    return IntegrationOpportunityResponse(
        opportunity_id=opp_id,
        section_id=section_id,
        task_ids=sorted_task_ids,
        departments_involved=departments,
        is_cross_department=is_cross_dept,
        compatibility_status=compatibility_status,
        compatibility_score=composite_score,
        combined_duration_hrs=combined_dur,
        priority_summary=priority_summary,
        compatibility_reasons=reasons,
        spatial_compatibility=spatial_status,
        temporal_compatibility=temporal_status,
        duration_compatibility=duration_status,
        resource_compatibility=resource_status,
        advisory_note=DEFAULT_ADVISORY_NOTE,
    )


class CompatibilityEngine:
    """Service to discover and rank integrated-block opportunities from database tasks."""

    @staticmethod
    async def load_task_profiles(db: AsyncSession) -> list[TaskProfile]:
        """Fetch all maintenance tasks with assets and compute planning priorities."""
        stmt = (
            select(MaintenanceTask)
            .options(selectinload(MaintenanceTask.asset))
            .where(MaintenanceTask.status.in_(["Open", "InProgress"]))
        )
        tasks = (await db.scalars(stmt)).all()

        profiles: list[TaskProfile] = []
        for t in tasks:
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
            profiles.append(
                TaskProfile(
                    task_id=t.task_id,
                    section_id=t.section_id or "UNKNOWN",
                    department=t.department,
                    severity=t.severity,
                    days_overdue=t.days_overdue or 0,
                    required_duration_hrs=float(t.required_duration_hrs or 2.0),
                    status=t.status or "Open",
                    computed_priority_score=p_res.computed_priority_score,
                    asset_id=t.asset_id,
                )
            )
        return profiles

    @classmethod
    async def find_all_opportunities(
        cls,
        db: AsyncSession,
        section_id: str | None = None,
        department: str | None = None,
        cross_department: bool | None = None,
        min_priority: float | None = None,
    ) -> list[IntegrationOpportunityResponse]:
        """Discover and rank candidate integration opportunities across sections."""
        profiles = await cls.load_task_profiles(db)

        # Group profiles by section
        by_section: dict[str, list[TaskProfile]] = {}
        for p in profiles:
            by_section.setdefault(p.section_id, []).append(p)

        opportunities: list[IntegrationOpportunityResponse] = []
        seen_opp_ids: set[str] = set()

        for sec, sec_profiles in by_section.items():
            if len(sec_profiles) < 2:
                continue

            # 1. Generate bounded pairs (size 2)
            for pair in itertools.combinations(sec_profiles, 2):
                opp = evaluate_group_compatibility(list(pair))
                if opp.compatibility_status != "INCOMPATIBLE" and opp.opportunity_id not in seen_opp_ids:
                    seen_opp_ids.add(opp.opportunity_id)
                    opportunities.append(opp)

            # 2. Generate bounded triples (size 3)
            # Prioritize cross-department triples (2 or 3 distinct departments)
            for triple in itertools.combinations(sec_profiles, 3):
                depts = set(t.department for t in triple)
                # For 3 tasks, focus on multi-department integration to avoid combinatorial noise
                if len(depts) >= 2:
                    opp = evaluate_group_compatibility(list(triple))
                    if opp.compatibility_status != "INCOMPATIBLE" and opp.opportunity_id not in seen_opp_ids:
                        seen_opp_ids.add(opp.opportunity_id)
                        opportunities.append(opp)

        # Apply filters
        filtered = opportunities
        if section_id:
            filtered = [o for o in filtered if o.section_id == section_id]
        if department:
            filtered = [o for o in filtered if department in o.departments_involved]
        if cross_department is not None:
            filtered = [o for o in filtered if o.is_cross_department == cross_department]
        if min_priority is not None:
            filtered = [o for o in filtered if o.priority_summary.highest_task_priority >= min_priority]

        # Rank opportunities: Cross-department first, then highest priority, then compatibility score
        filtered.sort(
            key=lambda o: (
                o.is_cross_department,
                o.priority_summary.highest_task_priority,
                o.compatibility_score,
            ),
            reverse=True,
        )

        return filtered

    @classmethod
    async def find_opportunities_for_task(
        cls,
        db: AsyncSession,
        task_id: str,
    ) -> list[IntegrationOpportunityResponse] | None:
        """Find all integration opportunities involving a specific task ID."""
        # Verify task exists
        task_exists = await db.scalar(
            select(MaintenanceTask.task_id).where(MaintenanceTask.task_id == task_id)
        )
        if not task_exists:
            return None

        all_opps = await cls.find_all_opportunities(db)
        task_opps = [o for o in all_opps if task_id in o.task_ids]
        return task_opps
