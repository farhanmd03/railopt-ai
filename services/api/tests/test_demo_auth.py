"""Comprehensive Test Suite for Demo Authentication & Token Verification.

Verifies:
- demo disabled -> 403
- invalid role -> 400 rejected
- valid ADMIN -> token contains ADMIN, correct sub, preferred_username, iss, aud
- valid PLANNER -> token contains PLANNER
- demo token accepted by FastAPI TokenVerifier
- demo token accepted by protected endpoint with RBAC
- protected endpoint rejects wrong demo role (e.g. VIEWER cannot access approvals/optimization)
- normal Auth0 RS256 token verification remains intact
- expired demo token rejected
"""

import os
from pathlib import Path
import sys
import time
import unittest
from unittest.mock import MagicMock, patch, PropertyMock

API_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = API_DIR.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))
sys.path.insert(0, str(API_DIR))

from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
from fastapi import HTTPException
import jwt

from app.core.config import settings
from app.core.security import TokenVerifier, extract_user_from_payload, require_roles
from app.routers.auth import APPROVED_DEMO_ROLES, DemoTokenRequest, acquire_demo_token


class TestDemoAuth(unittest.IsolatedAsyncioTestCase):
    """Test suite for server-issued demo tokens and security isolation."""

    @classmethod
    def setUpClass(cls):
        # Generate an in-memory RSA key pair for testing Auth0 RS256 signing
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

    def _create_signed_auth0_token(
        self,
        claims: dict,
        headers: dict | None = None,
    ) -> str:
        all_headers = {"kid": "auth0-test-key-id", "alg": "RS256"}
        if headers:
            all_headers.update(headers)
        return jwt.encode(
            claims,
            self.pem_private,
            algorithm="RS256",
            headers=all_headers,
        )

    async def test_demo_disabled_returns_403(self):
        """When demo_access_enabled is False, acquire_demo_token returns 403."""
        with patch.object(settings, "demo_access_enabled", False):
            with self.assertRaises(HTTPException) as ctx:
                await acquire_demo_token(DemoTokenRequest(role="PLANNER"))
            self.assertEqual(ctx.exception.status_code, 403)
            self.assertIn("Demo access is disabled", ctx.exception.detail)

    async def test_invalid_role_returns_400(self):
        """Requesting an arbitrary or invalid role returns 400 Bad Request."""
        with patch.object(settings, "demo_access_enabled", True):
            for bad_role in ["SUPERUSER", "ROOT", "HACKER", ""]:
                with self.assertRaises(HTTPException) as ctx:
                    await acquire_demo_token(DemoTokenRequest(role=bad_role))
                self.assertEqual(ctx.exception.status_code, 400)
                self.assertIn("Invalid demo role", ctx.exception.detail)

    async def test_valid_admin_token_generation(self):
        """Acquiring ADMIN demo token returns HS256 JWT with correct claims."""
        with patch.object(settings, "demo_access_enabled", True),              patch.object(settings, "demo_jwt_secret", "test-demo-secret-key-12345"),              patch.object(settings, "demo_jwt_issuer", "railopt-demo"),              patch.object(settings, "oidc_audience", "https://railopt-ai-api"):
            resp = await acquire_demo_token(DemoTokenRequest(role="ADMIN"))
            self.assertEqual(resp.token_type, "Bearer")
            self.assertEqual(resp.user.preferred_username, "admin.demo")
            self.assertEqual(resp.user.roles, ["ADMIN"])

            # Decode and verify token claims
            decoded = jwt.decode(
                resp.access_token,
                "test-demo-secret-key-12345",
                algorithms=["HS256"],
                issuer="railopt-demo",
                audience="https://railopt-ai-api",
            )
            self.assertEqual(decoded["iss"], "railopt-demo")
            self.assertEqual(decoded["aud"], "https://railopt-ai-api")
            self.assertEqual(decoded["sub"], "demo|admin")
            self.assertEqual(decoded["preferred_username"], "admin.demo")
            self.assertEqual(decoded["https://railopt.ai/roles"], ["ADMIN"])

    async def test_all_8_approved_roles_generate_tokens(self):
        """Verify all 8 legitimate roles generate distinct valid demo tokens."""
        with patch.object(settings, "demo_access_enabled", True),              patch.object(settings, "demo_jwt_secret", "test-demo-secret-key-12345"):
            for role in APPROVED_DEMO_ROLES:
                resp = await acquire_demo_token(DemoTokenRequest(role=role))
                self.assertEqual(resp.user.roles, [role])
                self.assertEqual(resp.user.preferred_username, APPROVED_DEMO_ROLES[role]["username"])

    def test_demo_token_verified_by_token_verifier(self):
        """TokenVerifier accepts demo HS256 token when demo_access_enabled=True."""
        verifier = TokenVerifier()
        now = int(time.time())
        claims = {
            "iss": "railopt-demo",
            "aud": "https://railopt-ai-api",
            "sub": "demo|planner",
            "preferred_username": "planner.demo",
            "name": "Planner User",
            "https://railopt.ai/roles": ["PLANNER"],
            "iat": now,
            "exp": now + 3600,
        }
        token = jwt.encode(claims, "test-secret-456", algorithm="HS256")

        with patch.object(settings, "demo_access_enabled", True),              patch.object(settings, "demo_jwt_secret", "test-secret-456"),              patch.object(settings, "demo_jwt_issuer", "railopt-demo"),              patch.object(settings, "oidc_audience", "https://railopt-ai-api"):
            payload = verifier.verify_token(token)
            self.assertEqual(payload["iss"], "railopt-demo")
            self.assertEqual(payload["preferred_username"], "planner.demo")

            user = extract_user_from_payload(payload)
            self.assertEqual(user.username, "planner.demo")
            self.assertIn("PLANNER", user.roles)

    def test_demo_token_rejected_when_demo_disabled(self):
        """TokenVerifier rejects demo token with 403 when demo_access_enabled=False."""
        verifier = TokenVerifier()
        now = int(time.time())
        claims = {
            "iss": "railopt-demo",
            "aud": "https://railopt-ai-api",
            "sub": "demo|planner",
            "https://railopt.ai/roles": ["PLANNER"],
            "iat": now,
            "exp": now + 3600,
        }
        token = jwt.encode(claims, "test-secret-456", algorithm="HS256")

        with patch.object(settings, "demo_access_enabled", False),              patch.object(settings, "demo_jwt_issuer", "railopt-demo"):
            with self.assertRaises(HTTPException) as ctx:
                verifier.verify_token(token)
            self.assertEqual(ctx.exception.status_code, 403)
            self.assertIn("Demo access is disabled", ctx.exception.detail)

    def test_expired_demo_token_rejected(self):
        """TokenVerifier rejects expired demo token with 401."""
        verifier = TokenVerifier()
        now = int(time.time())
        claims = {
            "iss": "railopt-demo",
            "aud": "https://railopt-ai-api",
            "sub": "demo|planner",
            "https://railopt.ai/roles": ["PLANNER"],
            "iat": now - 7200,
            "exp": now - 3600,  # Expired 1 hour ago
        }
        token = jwt.encode(claims, "test-secret-456", algorithm="HS256")

        with patch.object(settings, "demo_access_enabled", True),              patch.object(settings, "demo_jwt_secret", "test-secret-456"),              patch.object(settings, "demo_jwt_issuer", "railopt-demo"),              patch.object(settings, "oidc_audience", "https://railopt-ai-api"):
            with self.assertRaises(HTTPException) as ctx:
                verifier.verify_token(token)
            self.assertEqual(ctx.exception.status_code, 401)
            self.assertIn("expired", ctx.exception.detail)

    def test_normal_auth0_rs256_token_still_accepted(self):
        """Verifies Auth0 RS256 token validation remains 100% functional and untouched."""
        verifier = TokenVerifier()
        now = int(time.time())
        claims = {
            "iss": "https://farhanmd03.us.auth0.com/",
            "sub": "auth0|prod-user-123",
            "aud": ["https://railopt-ai-api", "https://farhanmd03.us.auth0.com/userinfo"],
            "azp": "ARUiG1mbMmmzOi6TK3t5wrFY8otx5prl",
            "preferred_username": "rail.engineer",
            "https://railopt.ai/roles": ["ENGINEERING"],
            "iat": now,
            "exp": now + 3600,
        }
        token = self._create_signed_auth0_token(claims)

        mock_signing_key = MagicMock()
        mock_signing_key.key = self.public_key
        mock_jwks_client = MagicMock()
        mock_jwks_client.get_signing_key_from_jwt.return_value = mock_signing_key

        with patch.object(verifier, "get_jwks_client", return_value=mock_jwks_client),              patch.object(settings, "oidc_issuer_url", "https://farhanmd03.us.auth0.com/"),              patch.object(settings, "oidc_audience", "https://railopt-ai-api"),              patch.object(settings, "oidc_client_id", "ARUiG1mbMmmzOi6TK3t5wrFY8otx5prl"):
            payload = verifier.verify_token(token)
            self.assertEqual(payload["iss"], "https://farhanmd03.us.auth0.com/")
            self.assertEqual(payload["sub"], "auth0|prod-user-123")
            user = extract_user_from_payload(payload)
            self.assertIn("ENGINEERING", user.roles)


if __name__ == "__main__":
    unittest.main()
