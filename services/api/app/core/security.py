"""Security and Keycloak OIDC JWT token validation with RBAC dependencies."""

from __future__ import annotations

import logging
import time
from typing import Any, Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import jwt
from jwt.exceptions import ExpiredSignatureError, InvalidTokenError, PyJWKClientError
from pydantic import BaseModel, Field
import urllib.request
import json

from app.core.config import settings

logger = logging.getLogger(__name__)

# Bearer scheme without auto_error so we control exact 401 response structure
http_bearer = HTTPBearer(auto_error=False)


class User(BaseModel):
    """Authenticated user context extracted from validated Keycloak token."""

    id: str
    username: str
    email: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    roles: list[str] = Field(default_factory=list)

    def has_role(self, role: str) -> bool:
        """Check if user has a specific role."""
        return role in self.roles

    def has_any_role(self, *roles: str) -> bool:
        """Check if user has at least one of the specified roles."""
        return any(r in self.roles for r in roles)


class TokenVerifier:
    """Manages OIDC JWKS caching and cryptographic JWT verification (Auth0 / Keycloak)."""

    def __init__(self):
        self._jwks_client: jwt.PyJWKClient | None = None
        self._cached_issuer: str | None = None

    @property
    def jwks_url(self) -> str:
        return settings.effective_oidc_jwks_url

    @property
    def valid_issuers(self) -> list[str]:
        iss = settings.effective_oidc_issuer.rstrip("/")
        issuers = [iss, f"{iss}/"]
        if "localhost" in iss:
            alt = iss.replace("localhost", "127.0.0.1")
            issuers.extend([alt, f"{alt}/"])
        elif "127.0.0.1" in iss:
            alt = iss.replace("127.0.0.1", "localhost")
            issuers.extend([alt, f"{alt}/"])
        return issuers

    def get_jwks_client(self) -> jwt.PyJWKClient:
        if self._jwks_client is None:
            self._jwks_client = jwt.PyJWKClient(self.jwks_url, cache_jwk_set=True, lifespan=3600)
        return self._jwks_client

    def verify_token(self, token: str) -> dict[str, Any]:
        """Cryptographically verify token signature, issuer, expiry, and target audience."""
        try:
            jwks_client = self.get_jwks_client()
            signing_key = jwks_client.get_signing_key_from_jwt(token)

            # First decode to inspect issuer without strict single-string enforcement
            unverified_claims = jwt.decode(token, options={"verify_signature": False})
            issuer = unverified_claims.get("iss")

            if issuer not in self.valid_issuers:
                logger.warning("Token issuer '%s' not in valid issuers %s", issuer, self.valid_issuers)
                raise InvalidTokenError(f"Invalid token issuer: {issuer}")

            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256"],
                issuer=issuer,
                leeway=10,
                options={
                    "verify_signature": True,
                    "verify_exp": True,
                    "verify_iss": True,
                    "verify_aud": False,  # Custom multi-audience validation handled explicitly below
                },
            )

            # Validate target API audience and/or authorized party (azp / aud)
            azp = payload.get("azp")
            aud = payload.get("aud")
            expected_aud = settings.effective_oidc_audience
            expected_client = settings.effective_oidc_client_id

            valid_client = False
            # 1. Match configured API audience (e.g. https://railopt-ai-api)
            if isinstance(aud, list) and expected_aud in aud:
                valid_client = True
            elif isinstance(aud, str) and aud == expected_aud:
                valid_client = True
            # 2. Match authorized party or client ID
            elif azp in (expected_client, expected_aud):
                valid_client = True
            elif isinstance(aud, list) and expected_client in aud:
                valid_client = True
            elif isinstance(aud, str) and aud == expected_client:
                valid_client = True
            # 3. Match Keycloak resource_access mapping if present
            elif expected_client in payload.get("resource_access", {}):
                valid_client = True

            if not valid_client:
                logger.warning(
                    "Token client/audience validation failed. azp='%s', aud=%s, expected_aud='%s', expected_client='%s'",
                    azp,
                    aud,
                    expected_aud,
                    expected_client,
                )
                raise InvalidTokenError("Token not issued for this client application or API audience")

            return payload

        except ExpiredSignatureError as exc:
            logger.info("Token verification failed: token expired")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication token has expired",
                headers={"WWW-Authenticate": "Bearer"},
            ) from exc
        except (InvalidTokenError, PyJWKClientError, Exception) as exc:
            logger.warning("Token verification failed: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or malformed authentication token",
                headers={"WWW-Authenticate": "Bearer"},
            ) from exc


# Alias for backward compatibility
KeycloakTokenVerifier = TokenVerifier
token_verifier = TokenVerifier()


def extract_user_from_payload(payload: dict[str, Any]) -> User:
    """Extract User domain model with roles from validated claims (Auth0 / Generic OIDC / Keycloak)."""
    extracted_roles: set[str] = set()

    # 1. Auth0 namespaced roles claim (https://railopt.ai/roles)
    auth0_roles = payload.get("https://railopt.ai/roles")
    if isinstance(auth0_roles, list):
        for r in auth0_roles:
            if isinstance(r, str):
                extracted_roles.add(r.upper())

    # 2. Direct top-level roles / groups claim
    for claim_key in ("roles", "groups", "permissions"):
        direct_claims = payload.get(claim_key)
        if isinstance(direct_claims, list):
            for r in direct_claims:
                if isinstance(r, str):
                    extracted_roles.add(r.upper())

    # 3. Keycloak realm roles
    realm_roles = payload.get("realm_access", {}).get("roles", [])
    if isinstance(realm_roles, list):
        for r in realm_roles:
            if isinstance(r, str):
                extracted_roles.add(r.upper())

    # 4. Keycloak client roles
    client_id = settings.effective_oidc_client_id
    client_roles = (
        payload.get("resource_access", {})
        .get(client_id, {})
        .get("roles", [])
    )
    if isinstance(client_roles, list):
        for r in client_roles:
            if isinstance(r, str):
                extracted_roles.add(r.upper())

    all_roles = sorted(list(extracted_roles))

    username = (
        payload.get("preferred_username")
        or payload.get("nickname")
        or payload.get("email")
        or payload.get("sub", "")
    )

    return User(
        id=str(payload.get("sub", "")),
        username=str(username),
        email=payload.get("email"),
        first_name=payload.get("given_name"),
        last_name=payload.get("family_name"),
        roles=all_roles,
    )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(http_bearer),
) -> User:
    """FastAPI dependency to extract and validate current authenticated user.

    Raises HTTP 401 if token is missing, invalid, expired, or signature is invalid.
    """
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    payload = token_verifier.verify_token(token)
    return extract_user_from_payload(payload)


def require_roles(*allowed_roles: str) -> Callable[[User], User]:
    """Dependency factory returning a dependency that enforces RBAC roles.

    Raises HTTP 403 if authenticated user does not have any of the allowed roles.
    """

    async def role_checker(user: User = Depends(get_current_user)) -> User:
        if not user.has_any_role(*allowed_roles):
            logger.warning(
                "Access denied for user '%s'. User roles: %s, Required: %s",
                user.username,
                user.roles,
                allowed_roles,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: insufficient role privileges",
            )
        return user

    return role_checker
