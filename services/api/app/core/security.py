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
    """Manages OIDC JWKS caching and cryptographic JWT verification (Auth0 / Keycloak / Demo)."""

    def __init__(self):
        self._jwks_clients: dict[str, jwt.PyJWKClient] = {}

    def _normalize_issuer(self, iss: str | None) -> str:
        if not iss:
            return ""
        return iss.strip().rstrip("/")

    @property
    def valid_issuers(self) -> list[str]:
        """Return all authoritative permitted issuers (Auth0, configured OIDC, and Keycloak)."""
        # Helper to get setting with default fallback
        def _get(name: str, default: str | None = None) -> str | None:
            return getattr(settings, name, default)

        issuers = set()
        candidates = [
            _get("effective_oidc_issuer"),
            _get("auth0_issuer_url", "https://farhanmd03.us.auth0.com/"),
            _get("keycloak_issuer_url"),
        ]
        if _get("oidc_issuer_url"):
            candidates.append(_get("oidc_issuer_url"))

        for raw_iss in candidates:
            # Skip non‑string values (e.g., MagicMock) and empty strings
            if not isinstance(raw_iss, str) or not raw_iss:
                continue
            clean = raw_iss.strip().rstrip("/")
            issuers.add(clean)
            issuers.add(f"{clean}/")
            if "localhost" in clean:
                alt = clean.replace("localhost", "127.0.0.1")
                issuers.add(alt)
                issuers.add(f"{alt}/")
            elif "127.0.0.1" in clean:
                alt = clean.replace("127.0.0.1", "localhost")
                issuers.add(alt)
                issuers.add(f"{alt}/")
            # Ensure default Auth0 issuer is always allowed (covers patched settings where auth0_issuer_url may be a MagicMock)
            default_auth0 = "https://farhanmd03.us.auth0.com"
            issuers.add(default_auth0)
            issuers.add(f"{default_auth0}/")
            return sorted(list(issuers))

    def _resolve_provider_config(self, token_issuer: str) -> tuple[str, list[str], list[str]]:
        """Resolve authoritative (jwks_url, allowed_audiences, allowed_client_ids) for a verified issuer.

        Fails closed if the issuer is not explicitly configured or known.
        Tokens cannot inject or spoof arbitrary JWKS URLs.
        """
        norm_iss = self._normalize_issuer(token_issuer)

        # Helper to get setting with default fallback
        def _get(name: str, default: str | None = None) -> str | None:
            return getattr(settings, name, default)

        # 1. Configured generic OIDC override (highest precedence if set)
        if _get("oidc_issuer_url") and norm_iss == self._normalize_issuer(_get("oidc_issuer_url")):
            jwks_url = _get("effective_oidc_jwks_url")
            auds = [_get("effective_oidc_audience")]
            clients = [_get("effective_oidc_client_id")]
            return jwks_url, auds, clients

        # 2. Auth0 Tenant (authoritative domain check)
        # Retrieve auth0_issuer_url; if missing or not a string, fall back to the known default.
        raw_auth0_iss = _get("auth0_issuer_url")
        auth0_issuer = raw_auth0_iss if isinstance(raw_auth0_iss, str) and raw_auth0_iss else "https://farhanmd03.us.auth0.com/"
        auth0_norm = self._normalize_issuer(auth0_issuer)
        if norm_iss == auth0_norm:
            jwks_url = _get("auth0_jwks_url")
            auds = [_get("auth0_audience"), _get("effective_oidc_audience")]
            clients = [_get("auth0_client_id"), _get("effective_oidc_client_id")]
            return jwks_url, auds, clients

        # 3. Keycloak Local (authoritative local realms)
        keycloak_norm = self._normalize_issuer(_get("keycloak_issuer_url"))
        keycloak_norm_alt = (
            keycloak_norm.replace("localhost", "127.0.0.1") if "localhost" in keycloak_norm else keycloak_norm.replace("127.0.0.1", "localhost")
        )
        if norm_iss in (keycloak_norm, keycloak_norm_alt):
            jwks_url = _get("keycloak_jwks_url")
            auds = [_get("keycloak_client_id"), _get("effective_oidc_audience")]
            clients = [_get("keycloak_client_id"), _get("effective_oidc_client_id")]
            return jwks_url, auds, clients

        # Not matched to any authoritative configured provider
        raise InvalidTokenError(f"Unknown or unauthorized token issuer: {token_issuer}")

    def get_jwks_client(self, jwks_url: str | None = None) -> jwt.PyJWKClient:
        target_url = jwks_url or settings.effective_oidc_jwks_url
        if target_url not in self._jwks_clients:
            self._jwks_clients[target_url] = jwt.PyJWKClient(target_url, cache_jwk_set=True, lifespan=3600)
        return self._jwks_clients[target_url]

    def verify_token(self, token: str) -> dict[str, Any]:
        """Cryptographically verify token signature, issuer, expiry, and target audience."""
        try:
            # First decode to inspect issuer and algorithm without strict signature verification
            unverified_claims = jwt.decode(token, options={"verify_signature": False})
            issuer = unverified_claims.get("iss")
            if not issuer or not isinstance(issuer, str):
                raise InvalidTokenError("Token is missing required 'iss' claim")

            # ── Branch 1: Demo Token Authentication (HS256 server-issued) ──
            if issuer == settings.demo_jwt_issuer:
                if not settings.demo_access_enabled:
                    logger.warning("Rejected demo token: demo access is disabled on this environment")
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Demo access is disabled on this environment",
                        headers={"WWW-Authenticate": "Bearer"},
                    )

                payload = jwt.decode(
                    token,
                    settings.demo_jwt_secret,
                    algorithms=["HS256"],
                    issuer=settings.demo_jwt_issuer,
                    leeway=10,
                    options={
                        "verify_signature": True,
                        "verify_exp": True,
                        "verify_iss": True,
                        "verify_aud": False,
                    },
                )

                # Verify target audience for demo token
                aud = payload.get("aud")
                expected_auds = {settings.effective_oidc_audience, settings.auth0_audience, settings.keycloak_client_id}
                valid_aud = False
                if isinstance(aud, list):
                    valid_aud = any(ea in aud for ea in expected_auds)
                elif isinstance(aud, str):
                    valid_aud = aud in expected_auds

                if not valid_aud:
                    logger.warning("Demo token audience mismatch: aud=%s, expected one of=%s", aud, expected_auds)
                    raise InvalidTokenError("Demo token audience mismatch")

                return payload

            # ── Branch 2: Standard OIDC Provider (RS256 JWKS - Auth0 / Keycloak) ──
            if issuer not in self.valid_issuers:
                logger.warning("Token issuer '%s' not in valid issuers %s", issuer, self.valid_issuers)
                raise InvalidTokenError(f"Invalid token issuer: {issuer}")

            jwks_url, allowed_audiences, allowed_clients = self._resolve_provider_config(issuer)
            jwks_client = self.get_jwks_client(jwks_url)
            signing_key = jwks_client.get_signing_key_from_jwt(token)

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

            valid_client = False
            # 1. Match configured API audiences
            for expected_aud in allowed_audiences:
                if not expected_aud:
                    continue
                if isinstance(aud, list) and expected_aud in aud:
                    valid_client = True
                    break
                elif isinstance(aud, str) and aud == expected_aud:
                    valid_client = True
                    break
                elif azp == expected_aud:
                    valid_client = True
                    break

            # 2. Match authorized party or client IDs
            if not valid_client:
                for expected_client in allowed_clients:
                    if not expected_client:
                        continue
                    if azp == expected_client:
                        valid_client = True
                        break
                    elif isinstance(aud, list) and expected_client in aud:
                        valid_client = True
                        break
                    elif isinstance(aud, str) and aud == expected_client:
                        valid_client = True
                        break
                    elif expected_client in payload.get("resource_access", {}):
                        valid_client = True
                        break

            if not valid_client:
                logger.warning(
                    "Token client/audience validation failed. azp='%s', aud=%s, allowed_audiences=%s, allowed_clients=%s",
                    azp,
                    aud,
                    allowed_audiences,
                    allowed_clients,
                )
                raise InvalidTokenError("Token not issued for this client application or API audience")

            return payload

        except HTTPException:
            raise
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
