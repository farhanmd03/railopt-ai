"""Deterministic Prototype Maintenance Priority Engine.

=============================================================================
DISCLAIMER & PURPOSE:
This module calculates a DETERMINISTIC PROTOTYPE MAINTENANCE PRIORITY SCORE
for decision-support and block planning in this SIH prototype.
It is NOT a certified railway safety risk score and does NOT use machine
learning or black-box predictions. All calculations are explicit, bounded,
and explainable.

The returned `computed_priority_score` is derived dynamically at runtime.
The database column `maintenance_tasks.priority_score` represents the static
synthetic `baseline_priority_score` from the frozen dataset.

Subsequent optimization modules should consume domain-level priority calculations
from this engine rather than importing API response schemas.
=============================================================================

VERIFIED POSTGRESQL DATASET RANGES:
- Asset.criticality_index:
    Observed Range: 1.0 to 5.0 (Average: ~3.09, discrete ratings 1.0, 2.0, 3.0, 4.0, 5.0).
    Scale Ceiling: 5.0
- Asset.failure_risk_score:
    Observed Range: 0.026 to 0.685 (Average: ~0.268, continuous 0.0 - 1.0 probability ratio).
    Scale Ceiling: 1.0
- MaintenanceTask.days_overdue:
    Observed Range: 2 to 58 days (Average: ~16.21 days).
    Normalization Ceiling: 30.0 days (overdue >= 30 days maps to 100.0).
- MaintenanceTask.priority_score (Baseline):
    Observed Range: 5.0 to 99.0 (Average: ~34.15).

NULL & MISSING VALUE TREATMENT:
Missing criticality and failure risk values are assigned conservative below-midpoint
defaults for this prototype (criticality default = 40.0 / 2.0 out of 5, failure risk
default = 20.0 / 0.20) rather than being treated as statistically neutral.

Components & Weights (Sum = 1.00):
- Severity Component (35% weight):
    Critical = 100.0, High = 75.0, Medium = 50.0, Low = 25.0, Default/None = 25.0
- Overdue Component (25% weight):
    Normalized linearly from days_overdue (0 to 30+ days -> 0.0 to 100.0)
- Criticality Component (25% weight):
    Normalized from Asset criticality_index (1.0 to 5.0 -> 20.0 to 100.0, Default = 40.0)
- Failure Risk Component (15% weight):
    Normalized from Asset failure_risk_score (0.0 to 1.0 -> 0.0 to 100.0, Default = 20.0)

Final Composite Score:
    Score = round(0.35 * severity + 0.25 * overdue + 0.25 * criticality + 0.15 * failure_risk, 2)
    Bounded strictly to [0.0, 100.0]

Priority Bands:
    CRITICAL : score >= 80.0
    HIGH     : 60.0 <= score < 80.0
    MEDIUM   : 40.0 <= score < 60.0
    LOW      : score < 40.0
"""

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.domain.priority import PriorityCalculationResult, PriorityComponents
from app.models.asset import Asset, MaintenanceTask

logger = logging.getLogger(__name__)

# Severity mapping weights
SEVERITY_WEIGHTS: dict[str, float] = {
    "CRITICAL": 100.0,
    "HIGH": 75.0,
    "MEDIUM": 50.0,
    "LOW": 25.0,
}

# Component weights (Sum = 1.00)
WEIGHT_SEVERITY = 0.35
WEIGHT_OVERDUE = 0.25
WEIGHT_CRITICALITY = 0.25
WEIGHT_FAILURE_RISK = 0.15

# Overdue normalization ceiling (days)
MAX_OVERDUE_DAYS = 30.0

# Asset criticality scale ceiling (verified range: 1.0 - 5.0)
MAX_CRITICALITY_INDEX = 5.0


def calculate_severity_component(severity: str | None) -> float:
    """Normalize maintenance task defect severity to 0-100 scale."""
    if not severity:
        return 25.0  # Default to Low/Nominal
    normalized_key = severity.strip().upper()
    if normalized_key not in SEVERITY_WEIGHTS:
        logger.warning("Unrecognized severity '%s', defaulting to Low (25.0)", severity)
        return 25.0
    return SEVERITY_WEIGHTS[normalized_key]


def calculate_overdue_component(days_overdue: int | float | None) -> float:
    """Normalize days overdue to 0-100 scale."""
    if days_overdue is None or days_overdue <= 0:
        return 0.0
    # Linearly scale up to MAX_OVERDUE_DAYS (30 days = 100.0)
    score = (float(days_overdue) / MAX_OVERDUE_DAYS) * 100.0
    return min(100.0, max(0.0, score))


def calculate_criticality_component(criticality_index: float | None) -> float:
    """Normalize asset criticality index (verified 1.0 - 5.0 scale) to 0-100 scale.

    Missing values receive a conservative below-midpoint default of 40.0 (equivalent to 2.0 / 5.0).
    """
    if criticality_index is None:
        return 40.0
    score = (float(criticality_index) / MAX_CRITICALITY_INDEX) * 100.0
    return min(100.0, max(0.0, score))


def calculate_failure_risk_component(failure_risk_score: float | None) -> float:
    """Normalize asset failure risk score (verified 0.0 - 1.0 scale) to 0-100 scale.

    Missing values receive a conservative below-midpoint default of 20.0 (equivalent to 0.20).
    """
    if failure_risk_score is None:
        return 20.0
    score = float(failure_risk_score) * 100.0
    return min(100.0, max(0.0, score))


def determine_priority_band(score: float) -> str:
    """Derive discrete priority band from composite score."""
    if score >= 80.0:
        return "CRITICAL"
    if score >= 60.0:
        return "HIGH"
    if score >= 40.0:
        return "MEDIUM"
    return "LOW"


def generate_explainability_reasons(
    severity: str | None,
    days_overdue: int | None,
    asset_id: str | None,
    criticality_index: float | None,
    failure_risk_score: float | None,
    severity_comp: float,
    crit_comp: float,
    risk_comp: float,
) -> list[str]:
    """Generate deterministic, human-readable explainability rationale."""
    reasons: list[str] = []

    # Severity rationale
    if severity_comp >= 75.0 and severity:
        reasons.append(f"Task defect severity is rated as '{severity}'")

    # Overdue rationale
    if days_overdue is not None:
        if days_overdue > 14:
            reasons.append(f"Maintenance task is significantly overdue ({days_overdue} days)")
        elif days_overdue > 0:
            reasons.append(f"Maintenance task is overdue ({days_overdue} days)")

    # Asset criticality rationale
    if crit_comp >= 80.0 and criticality_index is not None:
        asset_label = f"Asset {asset_id}" if asset_id else "Associated asset"
        reasons.append(f"{asset_label} has high operational criticality ({criticality_index:.1f}/5.0)")

    # Failure risk rationale
    if risk_comp >= 40.0 and failure_risk_score is not None:
        asset_label = f"Asset {asset_id}" if asset_id else "Associated asset"
        reasons.append(f"{asset_label} exhibits elevated failure risk ({failure_risk_score:.3f})")

    # Fallback explanation if no high-severity triggers
    if not reasons:
        reasons.append("Standard maintenance priority based on nominal operational asset parameters")

    return reasons


def compute_priority(
    task_id: str,
    department: str,
    severity: str | None = None,
    days_overdue: int | None = None,
    asset_id: str | None = None,
    section_id: str | None = None,
    criticality_index: float | None = None,
    failure_risk_score: float | None = None,
    baseline_priority_score: float | None = None,
) -> PriorityCalculationResult:
    """Pure calculation function for maintenance priority scoring."""
    sev_comp = calculate_severity_component(severity)
    overdue_comp = calculate_overdue_component(days_overdue)
    crit_comp = calculate_criticality_component(criticality_index)
    risk_comp = calculate_failure_risk_component(failure_risk_score)

    raw_score = (
        (WEIGHT_SEVERITY * sev_comp)
        + (WEIGHT_OVERDUE * overdue_comp)
        + (WEIGHT_CRITICALITY * crit_comp)
        + (WEIGHT_FAILURE_RISK * risk_comp)
    )

    final_score = round(min(100.0, max(0.0, raw_score)), 2)
    priority_band = determine_priority_band(final_score)

    reasons = generate_explainability_reasons(
        severity=severity,
        days_overdue=days_overdue,
        asset_id=asset_id,
        criticality_index=criticality_index,
        failure_risk_score=failure_risk_score,
        severity_comp=sev_comp,
        crit_comp=crit_comp,
        risk_comp=risk_comp,
    )

    return PriorityCalculationResult(
        task_id=task_id,
        asset_id=asset_id,
        section_id=section_id,
        department=department,
        computed_priority_score=final_score,
        baseline_priority_score=baseline_priority_score,
        priority_band=priority_band,
        components=PriorityComponents(
            severity_component=round(sev_comp, 2),
            overdue_component=round(overdue_comp, 2),
            criticality_component=round(crit_comp, 2),
            failure_risk_component=round(risk_comp, 2),
        ),
        reasons=reasons,
    )


class PriorityEngine:
    """Service to evaluate task priorities from database records."""

    @staticmethod
    async def evaluate_task_priority(
        db: AsyncSession,
        task_id: str,
    ) -> PriorityCalculationResult | None:
        """Fetch task and associated asset from database and compute priority assessment."""
        stmt = (
            select(MaintenanceTask)
            .options(selectinload(MaintenanceTask.asset))
            .where(MaintenanceTask.task_id == task_id)
        )
        task = await db.scalar(stmt)
        if not task:
            return None

        criticality_index = task.asset.criticality_index if task.asset else None
        failure_risk_score = task.asset.failure_risk_score if task.asset else None

        return compute_priority(
            task_id=task.task_id,
            department=task.department,
            severity=task.severity,
            days_overdue=task.days_overdue,
            asset_id=task.asset_id,
            section_id=task.section_id,
            criticality_index=criticality_index,
            failure_risk_score=failure_risk_score,
            baseline_priority_score=task.priority_score,
        )
