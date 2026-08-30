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


class KeycloakTokenVerifier:
    """Manages Keycloak JWKS caching and cryptographic JWT verification."""

    def __init__(self):
        self._jwks_client: jwt.PyJWKClient | None = None
        self._cached_issuer: str | None = None

    @property
    def jwks_url(self) -> str:
        base = settings.keycloak_url.rstrip("/")
        # Normalize localhost to 127.0.0.1 for fast Windows routing if needed
        if "localhost" in base:
            base = base.replace("localhost", "127.0.0.1")
        return f"{base}/realms/{settings.keycloak_realm}/protocol/openid-connect/certs"

    @property
    def valid_issuers(self) -> list[str]:
        base = settings.keycloak_url.rstrip("/")
        issuers = [f"{base}/realms/{settings.keycloak_realm}"]
        if "localhost" in base:
            issuers.append(f"{base.replace('localhost', '127.0.0.1')}/realms/{settings.keycloak_realm}")
        elif "127.0.0.1" in base:
            issuers.append(f"{base.replace('127.0.0.1', 'localhost')}/realms/{settings.keycloak_realm}")
        return issuers

    def get_jwks_client(self) -> jwt.PyJWKClient:
        if self._jwks_client is None:
            self._jwks_client = jwt.PyJWKClient(self.jwks_url, cache_jwk_set=True, lifespan=3600)
        return self._jwks_client

    def verify_token(self, token: str) -> dict[str, Any]:
        """Cryptographically verify token signature, issuer, expiry, and client audience."""
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
                options={
                    "verify_signature": True,
                    "verify_exp": True,
                    "verify_iss": True,
                    "verify_aud": False,  # Keycloak access tokens put client_id in azp or aud
                },
            )

            # Validate exact client / audience matching (no broad/substring fallbacks)
            azp = payload.get("azp")
            aud = payload.get("aud")
            valid_client = False
            if azp == settings.keycloak_client_id:
                valid_client = True
            elif isinstance(aud, list) and settings.keycloak_client_id in aud:
                valid_client = True
            elif isinstance(aud, str) and aud == settings.keycloak_client_id:
                valid_client = True
            elif settings.keycloak_client_id in payload.get("resource_access", {}):
                valid_client = True

            if not valid_client:
                logger.warning(
                    "Token client validation failed. azp='%s', aud=%s, expected='%s'",
                    azp,
                    aud,
                    settings.keycloak_client_id,
                )
                raise InvalidTokenError("Token not issued for this client application")

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


token_verifier = KeycloakTokenVerifier()


def extract_user_from_payload(payload: dict[str, Any]) -> User:
    """Extract User domain model with realm & client roles from validated claims."""
    # Extract realm roles
    realm_roles = payload.get("realm_access", {}).get("roles", [])

    # Extract client roles if any
    client_roles = (
        payload.get("resource_access", {})
        .get(settings.keycloak_client_id, {})
        .get("roles", [])
    )

    all_roles = sorted(list(set(realm_roles + client_roles)))

    return User(
        id=str(payload.get("sub", "")),
        username=payload.get("preferred_username") or payload.get("sub", ""),
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
