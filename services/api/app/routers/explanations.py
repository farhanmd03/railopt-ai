"""Explainability API Router (Batch 7L).

Endpoints:
- POST /api/v1/explanations: Generate grounded, local Ollama-powered explanation.
- GET /api/v1/explanations/health: Check local Ollama connection and model readiness.
"""

from __future__ import annotations

import logging
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import User, require_roles
from app.schemas.explanation import (
    ExplanationHealthResponse,
    ExplanationRequest,
    ExplanationResponse,
)
from app.services.explainability_service import ExplainabilityService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/explanations", tags=["Explainability Layer"])

EXPLANATION_ROLES = (
    "ADMIN",
    "PLANNER",
    "CONTROL",
    "APPROVER",
    "VIEWER",
    "ENGINEERING",
    "SNT",
    "TRD",
)


@router.get(
    "/health",
    response_model=ExplanationHealthResponse,
    status_code=status.HTTP_200_OK,
    summary="Check local Ollama explanation service availability",
)
async def check_explanation_health(
    current_user: User = Depends(require_roles(*EXPLANATION_ROLES)),
) -> ExplanationHealthResponse:
    """Check whether local Ollama engine is reachable and configured properly."""
    service = ExplainabilityService()
    return await service.check_health()


@router.post(
    "",
    response_model=ExplanationResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate grounded natural-language explanation",
)
async def generate_explanation(
    request: ExplanationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*EXPLANATION_ROLES)),
) -> ExplanationResponse:
    """Generate structured, fact-grounded explanation for optimization results."""
    service = ExplainabilityService()
    return await service.generate_explanation(request, db)
