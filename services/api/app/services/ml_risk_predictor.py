"""XGBoost Prototype Maintenance Risk & Impact Predictor.

=============================================================================
DISCLAIMER:
This module implements a PROTOTYPE ML RISK PREDICTOR using XGBoost (v3.4.1).
Because historical authenticated Indian Railways telemetry is not accessible in
this competition sandbox, the model is trained on domain-grounded synthetic
feature distributions.
It is explicitly labeled as a PROTOTYPE ML PREDICTION and serves as a
decision-support signal, NOT an autonomous safety certifier.
=============================================================================
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

import numpy as np
import xgboost as xgb
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.asset import Asset, MaintenanceTask

logger = logging.getLogger(__name__)

SEVERITY_MAP = {
    "CRITICAL": 4.0,
    "HIGH": 3.0,
    "MEDIUM": 2.0,
    "LOW": 1.0,
}

DEPT_MAP = {
    "ENGINEERING": 0.0,
    "SNT": 1.0,
    "S&T": 1.0,
    "TRD": 2.0,
}


@dataclass(frozen=True)
class RiskFactor:
    """Individual contributing factor to the ML risk prediction."""

    factor: str
    impact: str  # "HIGH" | "MEDIUM" | "LOW"
    description: str


@dataclass(frozen=True)
class MlRiskPrediction:
    """Structured ML risk prediction result."""

    task_id: str
    risk_score: float
    risk_band: str  # "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"
    model_name: str
    is_prototype: bool
    prototype_disclaimer: str
    top_factors: list[RiskFactor]
    feature_summary: dict[str, Any]


class MlRiskPredictor:
    """XGBoost-based risk and failure impact regressor."""

    _model: xgb.XGBRegressor | None = None
    _feature_names: list[str] = [
        "severity_score",
        "days_overdue",
        "duration_hrs",
        "penalty_cost_norm",
        "criticality_index",
        "failure_risk_score",
        "dept_code",
    ]

    @classmethod
    def _init_model(cls) -> xgb.XGBRegressor:
        """Initialize and train a reproducible prototype XGBoost model on domain feature distributions."""
        if cls._model is not None:
            return cls._model

        np.random.seed(42)
        n_samples = 1000

        sev = np.random.choice([1.0, 2.0, 3.0, 4.0], size=n_samples, p=[0.2, 0.35, 0.3, 0.15])
        overdue = np.random.exponential(scale=15.0, size=n_samples).clip(0, 60)
        dur = np.random.uniform(1.0, 8.0, size=n_samples)
        cost = np.random.uniform(5.0, 95.0, size=n_samples)
        crit = np.random.choice([1.0, 2.0, 3.0, 4.0, 5.0], size=n_samples, p=[0.1, 0.2, 0.4, 0.2, 0.1])
        fail_risk = np.random.beta(a=2, b=5, size=n_samples).clip(0.0, 1.0)
        dept = np.random.choice([0.0, 1.0, 2.0], size=n_samples)

        X = np.column_stack([sev, overdue, dur, cost, crit, fail_risk, dept])

        base_risk = (
            (sev / 4.0) * 35.0
            + (np.clip(overdue / 30.0, 0, 1)) * 25.0
            + (crit / 5.0) * 20.0
            + fail_risk * 15.0
            + (dur / 8.0) * 5.0
        )
        compound = np.where((sev >= 3.0) & (overdue >= 20.0), 10.0, 0.0)
        y = np.clip(base_risk + compound + np.random.normal(0, 2.0, size=n_samples), 0.0, 100.0)

        model = xgb.XGBRegressor(
            n_estimators=40,
            max_depth=4,
            learning_rate=0.1,
            random_state=42,
            verbosity=0,
        )
        model.fit(X, y)
        cls._model = model
        logger.info("Initialized Prototype XGBoost Maintenance Risk Predictor successfully.")
        return model

    @classmethod
    def predict_risk(
        cls,
        task_id: str,
        severity: str | None,
        days_overdue: int | None,
        required_duration_hrs: float | None,
        postpone_penalty_cost: float | None,
        department: str | None,
        criticality_index: float | None,
        failure_risk_score: float | None,
    ) -> MlRiskPrediction:
        """Execute XGBoost inference for a given maintenance task and asset feature vector."""
        model = cls._init_model()

        sev_val = SEVERITY_MAP.get(str(severity or "").upper(), 1.0)
        overdue_val = float(days_overdue or 0)
        dur_val = float(required_duration_hrs or 2.0)
        cost_norm = min(100.0, float(postpone_penalty_cost or 0.0) / 500.0) if postpone_penalty_cost else 25.0
        crit_val = float(criticality_index or 2.0)
        fail_val = float(failure_risk_score or 0.20)
        dept_val = DEPT_MAP.get(str(department or "").upper(), 0.0)

        x_vec = np.array([[sev_val, overdue_val, dur_val, cost_norm, crit_val, fail_val, dept_val]])
        raw_pred = float(model.predict(x_vec)[0])
        risk_score = round(max(0.0, min(100.0, raw_pred)), 1)

        if risk_score >= 80.0:
            band = "CRITICAL"
        elif risk_score >= 60.0:
            band = "HIGH"
        elif risk_score >= 40.0:
            band = "MEDIUM"
        else:
            band = "LOW"

        factors: list[RiskFactor] = []

        if sev_val >= 4.0:
            factors.append(RiskFactor("Critical Defect Severity", "HIGH", "Task is classified as Critical severity requiring prompt remediation."))
        elif sev_val >= 3.0:
            factors.append(RiskFactor("High Defect Severity", "MEDIUM", "Task has High defect severity level."))

        if overdue_val >= 25.0:
            factors.append(RiskFactor(f"Extended Overdue ({int(overdue_val)} days)", "HIGH", f"Work order is overdue by {int(overdue_val)} days beyond maintenance cycle."))
        elif overdue_val >= 10.0:
            factors.append(RiskFactor(f"Overdue ({int(overdue_val)} days)", "MEDIUM", f"Task is overdue by {int(overdue_val)} days."))

        if crit_val >= 4.0:
            factors.append(RiskFactor(f"High Asset Criticality ({crit_val}/5.0)", "HIGH", "Fixed infrastructure asset is on a primary high-density track line."))
        elif crit_val >= 3.0:
            factors.append(RiskFactor(f"Moderate Asset Criticality ({crit_val}/5.0)", "MEDIUM", "Asset has moderate operational criticality."))

        if fail_val >= 0.40:
            factors.append(RiskFactor(f"Elevated Failure Risk ({fail_val:.2f})", "HIGH", "Telemetry indicators show elevated wear and probability of degradation."))

        if dur_val >= 4.0:
            factors.append(RiskFactor(f"Long Possession Duration ({dur_val:.1f}h)", "MEDIUM", f"Requires substantial track occupancy ({dur_val:.1f} hours)."))

        if not factors:
            factors.append(RiskFactor("Standard Maintenance Profile", "LOW", "Parameters are within normal operating tolerances."))

        return MlRiskPrediction(
            task_id=task_id,
            risk_score=risk_score,
            risk_band=band,
            model_name="XGBoost-Regressor-v1 (Prototype)",
            is_prototype=True,
            prototype_disclaimer=(
                "Prototype ML Prediction — Trained on domain-calibrated feature vectors. "
                "Serves as decision support alongside deterministic OR-Tools scheduling."
            ),
            top_factors=factors[:3],
            feature_summary={
                "severity": severity or "Low",
                "days_overdue": int(overdue_val),
                "required_duration_hrs": dur_val,
                "criticality_index": crit_val,
                "failure_risk_score": fail_val,
                "department": department or "Engineering",
            },
        )

    @classmethod
    async def evaluate_task_ml_risk(
        cls,
        db: AsyncSession,
        task_id: str,
    ) -> MlRiskPrediction | None:
        """Fetch task from DB and predict ML risk."""
        stmt = (
            select(MaintenanceTask)
            .options(selectinload(MaintenanceTask.asset))
            .where(MaintenanceTask.task_id == task_id)
        )
        task = (await db.scalars(stmt)).first()
        if not task:
            return None

        crit = task.asset.criticality_index if task.asset else None
        fail_risk = task.asset.failure_risk_score if task.asset else None

        return cls.predict_risk(
            task_id=task.task_id,
            severity=task.severity,
            days_overdue=task.days_overdue,
            required_duration_hrs=float(task.required_duration_hrs) if task.required_duration_hrs else None,
            postpone_penalty_cost=float(task.postpone_penalty_cost) if task.postpone_penalty_cost else None,
            department=task.department,
            criticality_index=crit,
            failure_risk_score=fail_risk,
        )
