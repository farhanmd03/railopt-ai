"""Deterministic Candidate Block Generation Engine (Batch 5C).

=============================================================================
DISCLAIMER & PURPOSE:
This module implements the CANDIDATE BLOCK GENERATION LAYER for evaluating
potential maintenance block scheduling options against corridor windows,
train section occupancy, freight demand forecasts, and resource availability.

A candidate block represents a COMPUTATIONAL SCHEDULING OPTION.
It is NOT an engineering, traffic-control, or safety approval, and does NOT
perform global optimization (which is handled by OR-Tools in Batch 6).
=============================================================================

Pipeline Architecture:
5A: Maintenance Priority
      ↓
5B: Maintenance Compatibility / Integration Opportunities
      ↓
5C: Candidate Block Generation (This Module)
      ↓
6:  OR-Tools Global Optimization
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
import logging
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.asset import Asset, MaintenanceTask
from app.models.corridor import CorridorWindow, FreightForecast
from app.models.operations import TrainSectionOccupancy
from app.models.resource import Resource, ResourceAvailability
from app.schemas.candidate_block import (
    DEFAULT_CANDIDATE_ADVISORY_NOTE,
    CandidateBlockResponse,
)
from app.schemas.compatibility import IntegrationOpportunityResponse
from app.services.compatibility_engine import CompatibilityEngine
from app.services.priority_engine import compute_priority

logger = logging.getLogger(__name__)


def check_train_conflicts(
    window_start: datetime,
    window_end: datetime,
    occupancies: list[TrainSectionOccupancy],
) -> tuple[bool, int, list[str]]:
    """Check for time interval overlap against daily repeating train occupancies across spanned dates.

    Interval logic: window_start < occ_end AND window_end > occ_start.
    Evaluates every calendar date the corridor window spans (handles midnight-spanning overnight windows).
    """
    w_tz = window_start.tzinfo
    start_date = window_start.date()
    end_date = window_end.date()

    # Generate all calendar dates spanned by the window
    dates_spanned: list[date] = []
    curr = start_date
    while curr <= end_date:
        dates_spanned.append(curr)
        curr += timedelta(days=1)

    conflict_trains: list[str] = []

    for occ in occupancies:
        if not occ.entry_time or not occ.exit_time:
            continue

        train_label = occ.train_id or occ.run_id or "Unspecified Train"

        for d in dates_spanned:
            occ_start = datetime.combine(d, occ.entry_time, tzinfo=w_tz)
            occ_end = datetime.combine(d, occ.exit_time, tzinfo=w_tz)
            if occ.exit_time < occ.entry_time:
                # Over-midnight train passage
                occ_end += timedelta(days=1)

            # Overlap interval condition
            if window_start < occ_end and window_end > occ_start:
                conflict_trains.append(train_label)
                break

    conflict_count = len(conflict_trains)
    has_conflict = conflict_count > 0
    return has_conflict, conflict_count, conflict_trains


def evaluate_freight(
    section_id: str,
    plan_date: date,
    forecasts: list[FreightForecast],
) -> tuple[bool, str | None, int | None, float | None, float | None, list[str]]:
    """Evaluate freight demand forecast for a section and date."""
    for ff in forecasts:
        if ff.section_id == section_id and ff.date == plan_date:
            traffic_lvl = (ff.traffic_level or "MEDIUM").upper()
            tonnage = float(ff.forecast_tonnage) if ff.forecast_tonnage is not None else None
            reasons = [
                f"Freight forecast is {traffic_lvl} ({ff.forecast_freight_trains or 0} trains, "
                f"{tonnage or 0:.0f} tonnes, confidence: {ff.forecast_confidence or 0.8:.2f})"
            ]
            return True, traffic_lvl, ff.forecast_freight_trains, tonnage, ff.forecast_confidence, reasons

    return False, None, None, None, None, ["Freight forecast data is unavailable for this section/date"]


def evaluate_resources(
    departments: list[str],
    plan_date: date,
    resources: list[Resource],
    availabilities: list[ResourceAvailability],
) -> tuple[str, bool, list[str], list[str]]:
    """Evaluate resource availability for candidate departments from database records."""
    matched_resource_ids: list[str] = []
    depot_labels: list[str] = []

    for dept in departments:
        dept_res = [r for r in resources if r.department.strip().lower() == dept.strip().lower()]
        for r in dept_res:
            matched_resource_ids.append(r.resource_id)
            if r.depot and r.depot not in depot_labels:
                depot_labels.append(r.depot)

    # Check date-specific availability records
    date_specific = [ra for ra in availabilities if ra.date == plan_date and ra.resource_id in matched_resource_ids]

    if not date_specific:
        # No date-specific availability table entries in prototype dataset -> UNVERIFIED
        reasons = [
            f"Resource availability is unverified for candidate date {plan_date.isoformat()} "
            f"({len(matched_resource_ids)} depot assets identified: {', '.join(matched_resource_ids)})"
        ]
        return "UNVERIFIED", False, matched_resource_ids, reasons

    # If date-specific records exist, verify all required departments have available resources
    available_res = [ra.resource_id for ra in date_specific if (ra.status or "").upper() == "AVAILABLE"]
    if len(available_res) >= len(departments):
        reasons = [f"Resources verified available for all {len(departments)} departments ({', '.join(available_res)})"]
        return "VERIFIED", True, available_res, reasons
    else:
        reasons = [f"Insufficient verified resources for required departments ({', '.join(departments)})"]
        return "UNAVAILABLE", False, available_res, reasons


def compute_candidate_score(
    priority_score: float,
    compatibility_score: float,
    window_dur_hrs: float,
    req_dur_hrs: float,
    train_conflict: bool,
    freight_level: str | None,
    freight_available: bool,
) -> float:
    """Calculate deterministic composite candidate score (0.0 - 100.0).

    Components & Weights:
    - Priority component (30% weight): Normalized from highest priority score
    - Compatibility component (20% weight): Normalized from opportunity compatibility
    - Window fit component (20% weight): Slack efficiency
    - Train conflict factor (15% weight): 100.0 if no conflict, 0.0 if conflict
    - Freight demand factor (15% weight): LOW=100, MEDIUM=70, HIGH=30, Missing=50
    """
    # 1. Priority component [0-100]
    prio_comp = min(100.0, max(0.0, priority_score))

    # 2. Compatibility component [0-100]
    comp_comp = min(100.0, max(0.0, compatibility_score))

    # 3. Window fit component [0-100]
    slack = window_dur_hrs - req_dur_hrs
    if slack < 0:
        fit_comp = 0.0
    elif slack <= 1.0:
        fit_comp = 100.0  # Optimal tight window
    elif slack <= 3.0:
        fit_comp = 80.0
    else:
        fit_comp = 60.0   # Excess idle slack

    # 4. Train conflict factor [0-100]
    train_comp = 0.0 if train_conflict else 100.0

    # 5. Freight factor [0-100]
    if not freight_available or not freight_level:
        freight_comp = 50.0
    elif freight_level == "LOW":
        freight_comp = 100.0
    elif freight_level == "MEDIUM":
        freight_comp = 70.0
    else:
        freight_comp = 30.0

    raw_score = (
        0.30 * prio_comp
        + 0.20 * comp_comp
        + 0.20 * fit_comp
        + 0.15 * train_comp
        + 0.15 * freight_comp
    )
    return round(min(100.0, max(0.0, raw_score)), 2)


class CandidateBlockEngine:
    """Service to generate and rank candidate block options from operational data."""

    @classmethod
    async def generate_candidates(
        cls,
        db: AsyncSession,
        section_id: str | None = None,
        opportunity_id: str | None = None,
        task_id: str | None = None,
        date_filter: date | None = None,
        feasibility_status: str | None = None,
    ) -> list[CandidateBlockResponse]:
        """Generate candidate blocks for integration opportunities and single tasks."""
        # 1. Load operational infrastructure data
        stmt_cw = select(CorridorWindow)
        if section_id:
            stmt_cw = stmt_cw.where(CorridorWindow.section_id == section_id)
        windows = (await db.scalars(stmt_cw)).all()

        stmt_occ = select(TrainSectionOccupancy)
        if section_id:
            stmt_occ = stmt_occ.where(TrainSectionOccupancy.section_id == section_id)
        occupancies = (await db.scalars(stmt_occ)).all()

        stmt_ff = select(FreightForecast)
        if section_id:
            stmt_ff = stmt_ff.where(FreightForecast.section_id == section_id)
        if date_filter:
            stmt_ff = stmt_ff.where(FreightForecast.date == date_filter)
        freight_forecasts = (await db.scalars(stmt_ff)).all()

        resources = (await db.scalars(select(Resource))).all()
        availabilities = (await db.scalars(select(ResourceAvailability))).all()

        # Group data by section
        windows_by_sec: dict[str, list[CorridorWindow]] = {}
        for w in windows:
            if w.section_id:
                windows_by_sec.setdefault(w.section_id, []).append(w)

        occs_by_sec: dict[str, list[TrainSectionOccupancy]] = {}
        for o in occupancies:
            if o.section_id:
                occs_by_sec.setdefault(o.section_id, []).append(o)

        candidates: list[CandidateBlockResponse] = []

        # 2. Evaluate Integration Opportunities
        opportunities = await CompatibilityEngine.find_all_opportunities(
            db=db,
            section_id=section_id,
        )

        for opp in opportunities:
            if opportunity_id and opp.opportunity_id != opportunity_id:
                continue
            if task_id and task_id not in opp.task_ids:
                continue

            sec_windows = windows_by_sec.get(opp.section_id, [])
            sec_occs = occs_by_sec.get(opp.section_id, [])

            for cw in sec_windows:
                if not cw.window_start or not cw.window_end:
                    continue
                w_date = cw.window_start.date()
                if date_filter and w_date != date_filter:
                    continue

                w_dur_hrs = (
                    round(cw.duration_mins / 60.0, 2)
                    if cw.duration_mins
                    else round((cw.window_end - cw.window_start).total_seconds() / 3600.0, 2)
                )
                req_dur_hrs = opp.combined_duration_hrs

                # Check duration feasibility
                is_dur_feasible = w_dur_hrs >= req_dur_hrs

                # Check train conflicts
                has_train_conflict, conflict_count, conflict_trains = check_train_conflicts(
                    cw.window_start, cw.window_end, sec_occs
                )

                # Determine computed feasibility status
                if not is_dur_feasible:
                    computed_feas = "DURATION_INSUFFICIENT"
                elif has_train_conflict:
                    computed_feas = "TRAIN_CONFLICT"
                else:
                    computed_feas = "FEASIBLE"

                # Evaluate freight
                f_avail, f_level, f_trains, f_tonnage, f_conf, f_reasons = evaluate_freight(
                    opp.section_id, w_date, freight_forecasts
                )

                # Evaluate resources
                r_check, r_avail, r_ids, r_reasons = evaluate_resources(
                    opp.departments_involved, w_date, resources, availabilities
                )

                # Candidate score
                score = compute_candidate_score(
                    priority_score=opp.priority_summary.highest_task_priority,
                    compatibility_score=opp.compatibility_score,
                    window_dur_hrs=w_dur_hrs,
                    req_dur_hrs=req_dur_hrs,
                    train_conflict=has_train_conflict,
                    freight_level=f_level,
                    freight_available=f_avail,
                )

                # Reasons & Warnings
                reasons: list[str] = []
                warnings: list[str] = []

                if is_dur_feasible:
                    slack = round(w_dur_hrs - req_dur_hrs, 2)
                    reasons.append(
                        f"Window {cw.window_id} provides {w_dur_hrs:.2f} hrs for a required {req_dur_hrs:.2f}-hour block "
                        f"(slack: {slack:.2f} hrs)"
                    )
                else:
                    warnings.append(
                        f"Window duration ({w_dur_hrs:.2f} hrs) is insufficient for required block duration ({req_dur_hrs:.2f} hrs)"
                    )

                if has_train_conflict:
                    warnings.append(
                        f"Train occupancy conflict: {conflict_count} train runs overlap this window ({', '.join(conflict_trains[:3])})"
                    )
                else:
                    reasons.append("No train section occupancy overlaps the candidate window interval")

                reasons.extend(f_reasons)
                reasons.extend(r_reasons)
                reasons.append(
                    f"Integrated opportunity with {len(opp.departments_involved)} departments: {', '.join(opp.departments_involved)}"
                )

                cand_id = f"CAND-{opp.section_id}-{cw.window_id}-{opp.opportunity_id}"

                candidates.append(
                    CandidateBlockResponse(
                        candidate_id=cand_id,
                        opportunity_id=opp.opportunity_id,
                        task_ids=opp.task_ids,
                        departments_involved=opp.departments_involved,
                        section_id=opp.section_id,
                        window_id=cw.window_id,
                        candidate_start=cw.window_start,
                        candidate_end=cw.window_end,
                        required_duration_hrs=req_dur_hrs,
                        window_duration_hrs=w_dur_hrs,
                        source_window_status=cw.window_status,
                        computed_feasibility_status=computed_feas,
                        train_conflict=has_train_conflict,
                        train_conflict_count=conflict_count,
                        freight_data_available=f_avail,
                        freight_level=f_level,
                        forecast_freight_trains=f_trains,
                        forecast_tonnage=f_tonnage,
                        freight_confidence=f_conf,
                        resource_check=r_check,
                        resources_available=r_avail,
                        resource_ids=r_ids,
                        priority_score=opp.priority_summary.highest_task_priority,
                        compatibility_score=opp.compatibility_score,
                        candidate_score=score,
                        reasons=reasons,
                        warnings=warnings,
                        advisory_note=DEFAULT_CANDIDATE_ADVISORY_NOTE,
                    )
                )

        # 3. Evaluate Single Tasks (for stand-alone task candidate generation)
        stmt_tasks = (
            select(MaintenanceTask)
            .options(selectinload(MaintenanceTask.asset))
            .where(MaintenanceTask.status.in_(["Open", "InProgress"]))
        )
        if section_id:
            stmt_tasks = stmt_tasks.where(MaintenanceTask.section_id == section_id)
        if task_id:
            stmt_tasks = stmt_tasks.where(MaintenanceTask.task_id == task_id)

        tasks = (await db.scalars(stmt_tasks)).all()

        # If evaluating a specific task or full catalog, generate single task candidates
        for t in tasks:
            if opportunity_id:
                # Opportunity-only filter requested
                continue

            sec_id = t.section_id or "UNKNOWN"
            sec_windows = windows_by_sec.get(sec_id, [])
            sec_occs = occs_by_sec.get(sec_id, [])

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

            req_dur_hrs = float(t.required_duration_hrs or 2.0)

            for cw in sec_windows:
                if not cw.window_start or not cw.window_end:
                    continue
                w_date = cw.window_start.date()
                if date_filter and w_date != date_filter:
                    continue

                w_dur_hrs = (
                    round(cw.duration_mins / 60.0, 2)
                    if cw.duration_mins
                    else round((cw.window_end - cw.window_start).total_seconds() / 3600.0, 2)
                )

                is_dur_feasible = w_dur_hrs >= req_dur_hrs
                has_train_conflict, conflict_count, conflict_trains = check_train_conflicts(
                    cw.window_start, cw.window_end, sec_occs
                )

                if not is_dur_feasible:
                    computed_feas = "DURATION_INSUFFICIENT"
                elif has_train_conflict:
                    computed_feas = "TRAIN_CONFLICT"
                else:
                    computed_feas = "FEASIBLE"

                f_avail, f_level, f_trains, f_tonnage, f_conf, f_reasons = evaluate_freight(
                    sec_id, w_date, freight_forecasts
                )
                r_check, r_avail, r_ids, r_reasons = evaluate_resources(
                    [t.department], w_date, resources, availabilities
                )

                score = compute_candidate_score(
                    priority_score=p_res.computed_priority_score,
                    compatibility_score=100.0,  # Single task has 100% self-compatibility
                    window_dur_hrs=w_dur_hrs,
                    req_dur_hrs=req_dur_hrs,
                    train_conflict=has_train_conflict,
                    freight_level=f_level,
                    freight_available=f_avail,
                )

                reasons = []
                warnings = []

                if is_dur_feasible:
                    slack = round(w_dur_hrs - req_dur_hrs, 2)
                    reasons.append(
                        f"Window {cw.window_id} provides {w_dur_hrs:.2f} hrs for a required {req_dur_hrs:.2f}-hour task "
                        f"(slack: {slack:.2f} hrs)"
                    )
                else:
                    warnings.append(
                        f"Window duration ({w_dur_hrs:.2f} hrs) is insufficient for required task duration ({req_dur_hrs:.2f} hrs)"
                    )

                if has_train_conflict:
                    warnings.append(
                        f"Train occupancy conflict: {conflict_count} train runs overlap this window ({', '.join(conflict_trains[:3])})"
                    )
                else:
                    reasons.append("No train section occupancy overlaps the candidate window interval")

                reasons.extend(f_reasons)
                reasons.extend(r_reasons)
                reasons.append(f"Single-task candidate for '{t.department}' ({t.task_id})")

                cand_id = f"CAND-{sec_id}-{cw.window_id}-{t.task_id}"

                candidates.append(
                    CandidateBlockResponse(
                        candidate_id=cand_id,
                        opportunity_id=None,
                        task_ids=[t.task_id],
                        departments_involved=[t.department],
                        section_id=sec_id,
                        window_id=cw.window_id,
                        candidate_start=cw.window_start,
                        candidate_end=cw.window_end,
                        required_duration_hrs=req_dur_hrs,
                        window_duration_hrs=w_dur_hrs,
                        source_window_status=cw.window_status,
                        computed_feasibility_status=computed_feas,
                        train_conflict=has_train_conflict,
                        train_conflict_count=conflict_count,
                        freight_data_available=f_avail,
                        freight_level=f_level,
                        forecast_freight_trains=f_trains,
                        forecast_tonnage=f_tonnage,
                        freight_confidence=f_conf,
                        resource_check=r_check,
                        resources_available=r_avail,
                        resource_ids=r_ids,
                        priority_score=p_res.computed_priority_score,
                        compatibility_score=100.0,
                        candidate_score=score,
                        reasons=reasons,
                        warnings=warnings,
                        advisory_note=DEFAULT_CANDIDATE_ADVISORY_NOTE,
                    )
                )

        # 4. Apply Filters
        filtered = candidates
        if feasibility_status:
            filtered = [c for c in filtered if c.computed_feasibility_status.upper() == feasibility_status.upper()]

        # 5. Sort Candidates: FEASIBLE first, then highest candidate_score descending
        filtered.sort(
            key=lambda c: (
                c.computed_feasibility_status == "FEASIBLE",
                c.candidate_score,
            ),
            reverse=True,
        )

        return filtered

    @classmethod
    async def get_candidate_by_id(
        cls,
        db: AsyncSession,
        candidate_id: str,
    ) -> CandidateBlockResponse | None:
        """Find a specific candidate block option by its candidate_id."""
        parts = candidate_id.split("-")
        sec_id = parts[1] if len(parts) > 1 and parts[1].startswith("HOW_SEC_") else None
        candidates = await cls.generate_candidates(db, section_id=sec_id)
        for c in candidates:
            if c.candidate_id == candidate_id:
                return c
        return None
