"""Possession readiness response schemas."""

from pydantic import BaseModel, Field


class ReadinessCheck(BaseModel):
    """One deterministic readiness check."""

    key: str
    label: str
    status: str = Field(..., pattern="^(PASS|PENDING|FAIL)$")
    message: str


class PossessionReadinessResponse(BaseModel):
    """Decision-support readiness assessment for a proposed block."""

    block_id: int
    readiness: str = Field(..., pattern="^(GO|HOLD|REDUCE)$")
    summary: str
    checks: list[ReadinessCheck]
    human_decision_required: bool = True