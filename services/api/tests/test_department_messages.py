"""Tests for Department Communication Messages on Optimized Blocks."""

import pytest
from app.models.negotiation import DepartmentMessage
from app.schemas.optimization import DepartmentMessageCreateRequest, DepartmentMessageResponse


def test_department_message_schema_validation():
    req = DepartmentMessageCreateRequest(
        department="Engineering",
        message="Need 30-minute buffer for track access machine mobilization.",
        message_type="CHAT",
    )
    assert req.department == "ENGINEERING"
    assert "Need 30-minute buffer" in req.message

    req_snt = DepartmentMessageCreateRequest(
        department="S&T",
        message="Point machine testing aligned with window.",
    )
    assert req_snt.department == "SNT"

    req_trd = DepartmentMessageCreateRequest(
        department="TRD",
        message="OHE power block requested.",
    )
    assert req_trd.department == "TRD"


def test_department_message_invalid_empty():
    with pytest.raises(Exception):
        DepartmentMessageCreateRequest(
            department="ENGINEERING",
            message="",
        )
