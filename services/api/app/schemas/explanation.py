"""Schemas for Ollama-powered Explainability Layer (Batch 7L).

All AI explanations are strictly grounded in deterministic facts gathered from
the database and CP-SAT solver outputs.
"""

from __future__ import annotations

from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ExplanationType(str, Enum):
    """Finite supported explanation types."""
    RUN_SUMMARY = "RUN_SUMMARY"
    BLOCK_EXPLANATION = "BLOCK_EXPLANATION"
    UNASSIGNED_TASK = "UNASSIGNED_TASK"
    SCENARIO_COMPARISON = "SCENARIO_COMPARISON"


class ExplanationRequest(BaseModel):
    """Request payload for generating an explanation."""
    explanation_type: ExplanationType = Field(
        ..., description="Type of explanation requested"
    )
    run_id: int = Field(
        ..., description="Base Optimization Run database ID"
    )
    block_id: Optional[int] = Field(
        None, description="Optimized Block database ID (for BLOCK_EXPLANATION)"
    )
    task_id: Optional[str] = Field(
        None, description="Maintenance Task ID string (for UNASSIGNED_TASK)"
    )
    scenario_id: Optional[str] = Field(
        None, description="Scenario ID string (for SCENARIO_COMPARISON)"
    )


class ExplanationHealthResponse(BaseModel):
    """Health and status of local Ollama explanation engine."""
    available: bool
    base_url: str
    model: str
    message: str


class ExplanationResponse(BaseModel):
    """Structured, verified explanation output."""
    explanation_type: ExplanationType
    summary: str = Field(..., description="High-level planner-friendly explanation summary")
    key_factors: List[str] = Field(
        default_factory=list,
        description="Key deterministic factors contributing to this result"
    )
    limitations: List[str] = Field(
        default_factory=list,
        description="Known constraints, trade-offs, or unavailable evidence"
    )
    confidence_note: str = Field(
        ..., description="Confidence boundary statement"
    )
    deterministic_facts: Dict[str, Any] = Field(
        default_factory=dict,
        description="Authoritative underlying facts used as evidence"
    )
    model_name: str = Field(..., description="Ollama model used for explanation")
    disclaimer: str = Field(
        "AI-generated explanation based on deterministic system outputs. "
        "The explanation does not make scheduling, safety, or approval decisions.",
        description="Mandatory advisory disclaimer"
    )
    generated_at: str = Field(..., description="ISO 8601 generation timestamp")
