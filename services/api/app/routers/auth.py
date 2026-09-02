"""Authentication and Demo Access Router for RailOpt AI.

Provides server-gated demo token acquisition for authorized evaluation roles.
Normal production SSO runs directly through Auth0.
"""

from __future__ import annotations

import logging
import time
from typing import Any

from fastapi import APIRouter, HTTPException, status
import jwt
from pydantic import BaseModel, Field

from app.core.config import settings

logger = logging.getLogger("railopt.auth")

router = APIRouter(prefix="/auth", tags=["Authentication"])

APPROVED_DEMO_ROLES = {
    "ADMIN": {
        "username": "admin.demo",
        "name": "Admin User",
        "email": "admin.demo@railopt.local",
    },
    "PLANNER": {
        "username": "planner.demo",
        "name": "Planner User",
        "email": "planner.demo@railopt.local",
    },
    "CONTROL": {
        "username": "control.demo",
        "name": "Section Controller",
        "email": "control.demo@railopt.local",
    },
    "APPROVER": {
        "username": "approver.demo",
        "name": "Block Approver",
        "email": "approver.demo@railopt.local",
    },
    "ENGINEERING": {
        "username": "engineering.demo",
        "name": "Engineering Officer",
        "email": "engineering.demo@railopt.local",
    },
    "SNT": {
        "username": "snt.demo",
        "name": "SignalTelecom Officer",
        "email": "snt.demo@railopt.local",
    },
    "TRD": {
        "username": "trd.demo",
        "name": "Traction Officer",
        "email": "trd.demo@railopt.local",
    },
    "VIEWER": {
        "username": "viewer.demo",
        "name": "Guest Viewer",
        "email": "viewer.demo@railopt.local",
    },
}


class DemoTokenRequest(BaseModel):
    """Payload to request a server-issued demo session token."""

    role: str = Field(
        ...,
        description="Target operational role: ADMIN, PLANNER, CONTROL, APPROVER, ENGINEERING, SNT, TRD, VIEWER",
        examples=["PLANNER"],
    )


class DemoTokenUser(BaseModel):
    """User profile metadata returned with demo token."""

    sub: str
    preferred_username: str
    name: str
    email: str
    roles: list[str]


class DemoTokenResponse(BaseModel):
    """Response containing signed demo JWT and profile metadata."""

    access_token: str
    token_type: str = "Bearer"
    expires_in: int
    user: DemoTokenUser


@router.post(
    "/demo-token",
    response_model=DemoTokenResponse,
    summary="Acquire a server-issued demo session token (SIH Evaluation)",
    description=(
        "Exchanges an approved operational role for a signed demo JWT. "
        "Intended explicitly as an evaluation-only public demo path for hackathon judging and project review. "
        "Strictly gated by server configuration: disabled and returns 403 Forbidden whenever DEMO_ACCESS_ENABLED=false."
    ),
)
async def acquire_demo_token(payload: DemoTokenRequest) -> DemoTokenResponse:
    """Generate a genuine HS256-signed JWT token for the specified demo role.

    DESIGN & SECURITY SPECIFICATION:
    - This is an evaluation-only public demo path enabled selectively for hackathon judges/evaluators.
    - It requires no external email registration and does not query or create Auth0 database users.
    - Security Invariant: The backend alone signs and validates demo tokens using server-only DEMO_JWT_SECRET.
    - The issuer is distinct ('railopt-demo') and never masquerades as Auth0.
    - Disabled by default in standard production; active only when DEMO_ACCESS_ENABLED=true on the backend server.
    """
    # 1. Environment Gate: Check if demo access is enabled on this backend
    if not settings.demo_access_enabled:
        logger.warning("Rejected demo token request: demo access is disabled on this server")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Demo access is disabled on this environment",
        )

    # 2. Role Whitelist Validation: Accept only the 8 legitimate approved roles
    normalized_role = payload.role.strip().upper()
    if normalized_role not in APPROVED_DEMO_ROLES:
        logger.warning("Rejected demo token request: invalid role '%s'", payload.role)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid demo role '{payload.role}'. Must be one of {sorted(list(APPROVED_DEMO_ROLES.keys()))}",
        )

    role_info = APPROVED_DEMO_ROLES[normalized_role]
    now = int(time.time())
    expires_in = settings.demo_jwt_expiry_seconds
    exp = now + expires_in

    # 3. Construct genuine demo JWT claims adhering strictly to requirements:
    #    iss: "railopt-demo", aud: settings.effective_oidc_audience,
    #    sub: "demo|<role>", preferred_username: "<role>.demo",
    #    https://railopt.ai/roles: ["ROLE"]
    claims: dict[str, Any] = {
        "iss": settings.demo_jwt_issuer,
        "aud": settings.effective_oidc_audience,
        "sub": f"demo|{normalized_role.lower()}",
        "preferred_username": role_info["username"],
        "name": role_info["name"],
        "email": role_info["email"],
        "https://railopt.ai/roles": [normalized_role],
        "roles": [normalized_role],
        "iat": now,
        "exp": exp,
    }

    # 4. Sign with server-side HS256 secret (DEMO_JWT_SECRET)
    encoded_token = jwt.encode(
        claims,
        settings.demo_jwt_secret,
        algorithm="HS256",
    )

    logger.info("Issued demo token for role=%s, username=%s", normalized_role, role_info["username"])

    return DemoTokenResponse(
        access_token=encoded_token,
        token_type="Bearer",
        expires_in=expires_in,
        user=DemoTokenUser(
            sub=claims["sub"],
            preferred_username=claims["preferred_username"],
            name=claims["name"],
            email=claims["email"],
            roles=[normalized_role],
        ),
    )
