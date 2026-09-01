"""Comprehensive test suite for Auth0 OIDC Migration & RBAC Compatibility.

Tests:
1. Settings property resolution for Auth0 (issuer, audience, jwks_url, client_id).
2. TokenVerifier valid_issuers contains both trailing slash and non-trailing slash forms.
3. TokenVerifier jwks_url points to .well-known/jwks.json when OIDC_ISSUER_URL is configured.
4. Cryptographic RS256 token verification with Auth0 issuer and API audience.
5. Strict audience validation: tokens with wrong audience are rejected.
6. Strict issuer validation: tokens with wrong issuer are rejected.
7. Role extraction from Auth0 namespaced claim 'https://railopt.ai/roles'.
8. Role extraction from top-level 'roles' claim.
9. Preservation of Keycloak 'realm_access' and 'resource_access' role extraction.
10. RBAC 'require_roles' authorization with Auth0 user context.
"""

from datetime import datetime, timedelta, timezone
from pathlib import Path
import sys
import unittest
from unittest.mock import MagicMock, patch

API_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = API_DIR.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))
sys.path.insert(0, str(API_DIR))

from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
from fastapi import HTTPException
import jwt

from app.core.config import Settings
from app.core.security import (
    TokenVerifier,
    User,
    extract_user_from_payload,
    require_roles,
)


class TestAuth0OIDCMigration(unittest.TestCase):
    """Test suite for Auth0 OIDC settings and token validation."""

    @classmethod
    def setUpClass(cls):
        # Generate an in-memory RSA key pair for testing RS256 signing
        cls.private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048,
        )
        cls.public_key = cls.private_key.public_key()
        cls.pem_private = cls.private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        )

    def _create_signed_token(
        self,
        claims: dict,
        kid: str = "test-key-id",
    ) -> str:
        headers = {"kid": kid, "alg": "RS256", "typ": "JWT"}
        return jwt.encode(claims, self.pem_private, algorithm="RS256", headers=headers)

    def test_01_auth0_settings_resolution(self):
        """1. Settings resolves Auth0 configuration with trailing slash normalization."""
        s = Settings(
            database_url="postgresql+psycopg://user:pass@localhost:5432/db",
            oidc_issuer_url="https://farhanmd03.us.auth0.com/",
            oidc_client_id="test_client_id_123",
            oidc_audience="https://railopt-ai-api",
        )
        self.assertEqual(s.effective_oidc_issuer, "https://farhanmd03.us.auth0.com/")
        self.assertEqual(s.effective_oidc_client_id, "test_client_id_123")
        self.assertEqual(s.effective_oidc_audience, "https://railopt-ai-api")
        self.assertEqual(
            s.effective_oidc_jwks_url,
            "https://farhanmd03.us.auth0.com/.well-known/jwks.json",
        )

    def test_02_keycloak_fallback_settings_resolution(self):
        """2. When OIDC_* is unset, Settings falls back to local Keycloak configuration."""
        s = Settings(
            database_url="postgresql+psycopg://user:pass@localhost:5432/db",
            oidc_issuer_url=None,
            keycloak_url="http://127.0.0.1:8080",
            keycloak_realm="railopt",
            keycloak_client_id="railopt-web",
        )
        self.assertEqual(s.effective_oidc_issuer, "http://127.0.0.1:8080/realms/railopt")
        self.assertEqual(s.effective_oidc_client_id, "railopt-web")
        self.assertEqual(s.effective_oidc_audience, "railopt-web")
        self.assertEqual(
            s.effective_oidc_jwks_url,
            "http://127.0.0.1:8080/realms/railopt/protocol/openid-connect/certs",
        )

    def test_03_valid_issuers_handles_trailing_slashes(self):
        """3. TokenVerifier includes both trailing slash and non-trailing slash in valid_issuers."""
        verifier = TokenVerifier()
        with patch("app.core.security.settings") as mock_settings:
            mock_settings.effective_oidc_issuer = "https://farhanmd03.us.auth0.com/"
            mock_settings.effective_oidc_jwks_url = "https://farhanmd03.us.auth0.com/.well-known/jwks.json"

            issuers = verifier.valid_issuers
            self.assertIn("https://farhanmd03.us.auth0.com", issuers)
            self.assertIn("https://farhanmd03.us.auth0.com/", issuers)

    def test_04_auth0_token_verification_success(self):
        """4. TokenVerifier validates RS256 token with Auth0 issuer, JWKS key, and API audience."""
        verifier = TokenVerifier()

        now = datetime.now(timezone.utc)
        claims = {
            "iss": "https://farhanmd03.us.auth0.com/",
            "sub": "auth0|64f1a2b3c4d5e6f7",
            "aud": ["https://railopt-ai-api", "https://farhanmd03.us.auth0.com/userinfo"],
            "azp": "auth0_client_id_123",
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(hours=1)).timestamp()),
            "https://railopt.ai/roles": ["ADMIN", "PLANNER"],
            "preferred_username": "planner.demo",
        }
        raw_jwt = self._create_signed_token(claims)

        # Mock PyJWKClient to return our test RSA public key
        mock_signing_key = MagicMock()
        mock_signing_key.key = self.public_key
        mock_jwks = MagicMock()
        mock_jwks.get_signing_key_from_jwt.return_value = mock_signing_key

        with patch.object(verifier, "get_jwks_client", return_value=mock_jwks):
            with patch("app.core.security.settings") as mock_settings:
                mock_settings.effective_oidc_issuer = "https://farhanmd03.us.auth0.com/"
                mock_settings.effective_oidc_audience = "https://railopt-ai-api"
                mock_settings.effective_oidc_client_id = "auth0_client_id_123"

                payload = verifier.verify_token(raw_jwt)
                self.assertEqual(payload["sub"], "auth0|64f1a2b3c4d5e6f7")
                self.assertEqual(payload["https://railopt.ai/roles"], ["ADMIN", "PLANNER"])

    def test_05_auth0_wrong_audience_rejected(self):
        """5. Tokens with an unexpected audience are rejected with HTTP 401."""
        verifier = TokenVerifier()

        now = datetime.now(timezone.utc)
        claims = {
            "iss": "https://farhanmd03.us.auth0.com/",
            "sub": "auth0|64f1a2b3c4d5e6f7",
            "aud": ["https://some-other-unauthorized-api"],
            "azp": "unauthorized_client",
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(hours=1)).timestamp()),
        }
        raw_jwt = self._create_signed_token(claims)

        mock_signing_key = MagicMock()
        mock_signing_key.key = self.public_key
        mock_jwks = MagicMock()
        mock_jwks.get_signing_key_from_jwt.return_value = mock_signing_key

        with patch.object(verifier, "get_jwks_client", return_value=mock_jwks):
            with patch("app.core.security.settings") as mock_settings:
                mock_settings.effective_oidc_issuer = "https://farhanmd03.us.auth0.com/"
                mock_settings.effective_oidc_audience = "https://railopt-ai-api"
                mock_settings.effective_oidc_client_id = "auth0_client_id_123"

                with self.assertRaises(HTTPException) as ctx:
                    verifier.verify_token(raw_jwt)
                self.assertEqual(ctx.exception.status_code, 401)

    def test_06_auth0_wrong_issuer_rejected(self):
        """6. Tokens with an unexpected issuer are rejected with HTTP 401."""
        verifier = TokenVerifier()

        now = datetime.now(timezone.utc)
        claims = {
            "iss": "https://malicious-tenant.us.auth0.com/",
            "sub": "auth0|malicious",
            "aud": "https://railopt-ai-api",
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(hours=1)).timestamp()),
        }
        raw_jwt = self._create_signed_token(claims)

        mock_signing_key = MagicMock()
        mock_signing_key.key = self.public_key
        mock_jwks = MagicMock()
        mock_jwks.get_signing_key_from_jwt.return_value = mock_signing_key

        with patch.object(verifier, "get_jwks_client", return_value=mock_jwks):
            with patch("app.core.security.settings") as mock_settings:
                mock_settings.effective_oidc_issuer = "https://farhanmd03.us.auth0.com/"
                mock_settings.effective_oidc_audience = "https://railopt-ai-api"
                mock_settings.effective_oidc_client_id = "auth0_client_id_123"

                with self.assertRaises(HTTPException) as ctx:
                    verifier.verify_token(raw_jwt)
                self.assertEqual(ctx.exception.status_code, 401)

    def test_07_extract_user_from_auth0_namespaced_roles(self):
        """7. extract_user_from_payload parses Auth0 'https://railopt.ai/roles' claim."""
        payload = {
            "sub": "auth0|123456",
            "preferred_username": "engineer.demo",
            "email": "engineer.demo@railopt.ai",
            "given_name": "Chief",
            "family_name": "Engineer",
            "https://railopt.ai/roles": ["engineering", "viewer"],
        }
        user = extract_user_from_payload(payload)
        self.assertEqual(user.id, "auth0|123456")
        self.assertEqual(user.username, "engineer.demo")
        self.assertEqual(user.email, "engineer.demo@railopt.ai")
        self.assertEqual(user.first_name, "Chief")
        self.assertEqual(user.roles, ["ENGINEERING", "VIEWER"])
        self.assertTrue(user.has_role("ENGINEERING"))
        self.assertFalse(user.has_role("ADMIN"))

    def test_08_extract_user_from_top_level_roles(self):
        """8. extract_user_from_payload parses standard top-level 'roles' array."""
        payload = {
            "sub": "auth0|789012",
            "nickname": "approver.demo",
            "roles": ["APPROVER"],
        }
        user = extract_user_from_payload(payload)
        self.assertEqual(user.roles, ["APPROVER"])
        self.assertTrue(user.has_role("APPROVER"))

    def test_09_extract_user_preserves_keycloak_roles(self):
        """9. extract_user_from_payload preserves Keycloak realm_access & resource_access roles."""
        payload = {
            "sub": "keycloak|abc",
            "preferred_username": "snt.demo",
            "realm_access": {"roles": ["snt", "viewer"]},
            "resource_access": {
                "railopt-web": {"roles": ["control"]}
            },
        }
        user = extract_user_from_payload(payload)
        self.assertIn("SNT", user.roles)
        self.assertIn("VIEWER", user.roles)
        self.assertIn("CONTROL", user.roles)

    def test_10_require_roles_dependency(self):
        """10. require_roles enforces strict RBAC against User object."""
        import asyncio

        user = User(
            id="auth0|999",
            username="planner.demo",
            roles=["PLANNER"],
        )

        # Allowed role
        checker = require_roles("ADMIN", "PLANNER")
        result = asyncio.run(checker(user))
        self.assertEqual(result.username, "planner.demo")

        # Disallowed role
        forbidden_checker = require_roles("ADMIN", "APPROVER")
        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(forbidden_checker(user))
        self.assertEqual(ctx.exception.status_code, 403)


if __name__ == "__main__":
    unittest.main()
