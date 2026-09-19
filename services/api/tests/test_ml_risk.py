"""Tests for XGBoost prototype ML risk prediction service and router."""

import pytest
from app.services.ml_risk_predictor import MlRiskPredictor


def test_xgboost_risk_prediction_critical_severity():
    pred = MlRiskPredictor.predict_risk(
        task_id="WO-TEST-001",
        severity="CRITICAL",
        days_overdue=35,
        required_duration_hrs=4.0,
        postpone_penalty_cost=25000.0,
        department="ENGINEERING",
        criticality_index=4.5,
        failure_risk_score=0.65,
    )
    assert pred.task_id == "WO-TEST-001"
    assert 0.0 <= pred.risk_score <= 100.0
    assert pred.risk_band in ("HIGH", "CRITICAL")
    assert pred.is_prototype is True
    assert "Prototype" in pred.model_name
    assert len(pred.top_factors) > 0
    assert pred.feature_summary["severity"] == "CRITICAL"


def test_xgboost_risk_prediction_low_severity():
    pred = MlRiskPredictor.predict_risk(
        task_id="WO-TEST-002",
        severity="LOW",
        days_overdue=0,
        required_duration_hrs=1.5,
        postpone_penalty_cost=1000.0,
        department="TRD",
        criticality_index=1.0,
        failure_risk_score=0.05,
    )
    assert pred.task_id == "WO-TEST-002"
    assert 0.0 <= pred.risk_score <= 100.0
    assert pred.risk_band in ("LOW", "MEDIUM")
    assert pred.is_prototype is True


def test_xgboost_handles_null_inputs():
    pred = MlRiskPredictor.predict_risk(
        task_id="WO-TEST-NULL",
        severity=None,
        days_overdue=None,
        required_duration_hrs=None,
        postpone_penalty_cost=None,
        department=None,
        criticality_index=None,
        failure_risk_score=None,
    )
    assert pred.task_id == "WO-TEST-NULL"
    assert 0.0 <= pred.risk_score <= 100.0
    assert pred.risk_band in ("LOW", "MEDIUM", "HIGH", "CRITICAL")


def test_ml_risk_integration_into_priority():
    from app.services.priority_engine import compute_priority

    # Baseline priority calculation without ML risk
    p_baseline = compute_priority(
        task_id="WO-PRIO-01",
        department="Engineering",
        severity="Medium",
        days_overdue=10,
        criticality_index=3.0,
        failure_risk_score=0.20,
    )

    # Calculate actual XGBoost ML risk prediction
    ml_pred = MlRiskPredictor.predict_risk(
        task_id="WO-PRIO-01",
        severity="Critical",
        days_overdue=25,
        required_duration_hrs=4.0,
        postpone_penalty_cost=20000.0,
        department="Engineering",
        criticality_index=4.5,
        failure_risk_score=0.70,
    )
    assert ml_pred.risk_score > 60.0

    # Priority calculation with XGBoost ML risk prediction passed
    p_with_ml = compute_priority(
        task_id="WO-PRIO-01",
        department="Engineering",
        severity="Medium",
        days_overdue=10,
        criticality_index=3.0,
        failure_risk_score=0.20,
        ml_risk_score=ml_pred.risk_score,
    )

    assert p_with_ml.ml_risk_score == ml_pred.risk_score
    assert p_with_ml.computed_priority_score > p_baseline.computed_priority_score
    assert any("XGBoost ML risk model" in r for r in p_with_ml.reasons)
