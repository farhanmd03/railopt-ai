"""Comprehensive test suite for Keycloak OIDC Authentication, Client Validation, and Backend RBAC.

Covers Batch 4.1 Security Fixes:
1. Exact client validation (azp == 'railopt-web', aud == 'railopt-web')
2. Rejection of broad/substring clients ('account', 'security-admin-console', 'fake-railopt-web', 'railopt-web-admin', 'admin')
3. Cryptographic signature and issuer validation
4. Expired token rejection
5. Role-based authorization (200 for allowed roles, 403 for disallowed roles)
6. Setup script KC_ADMIN_PASSWORD environment variable validation
"""

import asyncio
import json
import os
from pathlib import Path
import subprocess
import sys
import time
from unittest.mock import patch
import urllib.parse
import urllib.request

API_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = API_DIR.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))
sys.path.insert(0, str(API_DIR))

if sys.platform == "win32":
    try:
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    except Exception:
        pass

from app.core.config import settings
from app.core.security import token_verifier, User, require_roles
from app.main import app
from fastapi import APIRouter, Depends
import jwt


KEYCLOAK_URL = os.getenv("KEYCLOAK_URL", "http://127.0.0.1:8080").rstrip("/")
REALM = "railopt"
CLIENT_ID = "railopt-web"
DEMO_PASSWORD = os.getenv("DEMO_USER_PASSWORD", "railopt_demo_2026")


def obtain_user_token(username: str, password: str = DEMO_PASSWORD) -> str:
    """Acquire real JWT access token from Keycloak via direct access grant."""
    url = f"{KEYCLOAK_URL}/realms/{REALM}/protocol/openid-connect/token"
    data = urllib.parse.urlencode({
        "client_id": CLIENT_ID,
        "username": username,
        "password": password,
        "grant_type": "password",
        "scope": "openid profile email",
    }).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        res = json.loads(resp.read().decode("utf-8"))
        return res["access_token"]


async def asgi_request(
    app,
    method: str,
    path: str,
    token: str | None = None,
    query_string: str = "",
) -> tuple[int, dict]:
    """Execute an ASGI request directly through FastAPI."""
    headers = [
        (b"host", b"testserver"),
        (b"accept", b"application/json"),
    ]
    if token:
        headers.append((b"authorization", f"Bearer {token}".encode("utf-8")))

    scope = {
        "type": "http",
        "asgi": {"version": "3.0", "spec_version": "2.0"},
        "http_version": "1.1",
        "method": method.upper(),
        "scheme": "http",
        "path": path,
        "raw_path": path.encode("utf-8"),
        "query_string": query_string.encode("utf-8"),
        "headers": headers,
        "state": {},
    }

    response_status = 500
    response_body = bytearray()

    async def receive():
        return {"type": "http.request", "body": b"", "more_body": False}

    async def send(message):
        nonlocal response_status, response_body
        if message["type"] == "http.response.start":
            response_status = message["status"]
        elif message["type"] == "http.response.body":
            response_body.extend(message.get("body", b""))

    await app(scope, receive, send)
    parsed_json = json.loads(response_body.decode("utf-8")) if response_body else {}
    return response_status, parsed_json


async def run_auth_tests():
    print("============================================================")
    print("RAILOPT AI - BATCH 4.1 SECURITY & CLIENT VALIDATION TESTS")
    print("============================================================")

    # ── 1. Unauthenticated Request ────────────────────────────────
    status, data = await asgi_request(app, "GET", "/api/v1/maintenance-tasks")
    assert status == 401, f"Expected 401, got {status}: {data}"
    print("[PASS] 1. Missing token -> 401 Unauthorized")

    # ── 2. Real Keycloak Token Acquisition & Verification ──────────
    print("Acquiring genuine Keycloak tokens for test users...")
    admin_token = obtain_user_token("admin.demo")
    eng_token = obtain_user_token("engineering.demo")
    viewer_token = obtain_user_token("viewer.demo")
    print("[PASS] 2. Keycloak real tokens acquired successfully.")

    # ── 3. Exact Client Validation Tests (Fix 1) ───────────────────
    # A genuine token has azp == 'railopt-web'
    status, data = await asgi_request(app, "GET", "/api/v1/maintenance-tasks", token=eng_token)
    assert status == 200, f"Expected 200 for exact azp='railopt-web', got {status}: {data}"
    print("[PASS] 3. Exact azp == 'railopt-web' -> 200 OK")

    # Decode claims from real token to use for simulated client variations
    real_claims = jwt.decode(eng_token, options={"verify_signature": False})

    # Test rejected client variations
    rejected_clients = [
        "account",
        "security-admin-console",
        "fake-railopt-web",
        "railopt-web-admin",
        "admin",
        "my-railopt-web",
        "railopt-web-extra",
    ]

    for bad_client in rejected_clients:
        bad_claims = dict(real_claims)
        bad_claims["azp"] = bad_client
        bad_claims["aud"] = [bad_client]
        if "resource_access" in bad_claims:
            bad_claims["resource_access"] = {bad_client: {"roles": ["ENGINEERING"]}}

        # Mock token_verifier.verify_token to test the client-check logic
        with patch.object(jwt, "decode", return_value=bad_claims):
            status, data = await asgi_request(app, "GET", "/api/v1/maintenance-tasks", token=eng_token)
            assert status == 401, f"Expected 401 rejection for azp='{bad_client}', got {status}: {data}"
            print(f"[PASS] 4. Rejected non-matching client azp='{bad_client}' -> 401 Unauthorized")

    # Test exact aud match without azp
    aud_claims = dict(real_claims)
    aud_claims["azp"] = None
    aud_claims["aud"] = ["railopt-web"]
    with patch.object(jwt, "decode", return_value=aud_claims):
        status, data = await asgi_request(app, "GET", "/api/v1/maintenance-tasks", token=eng_token)
        assert status == 200, f"Expected 200 for exact aud containing 'railopt-web', got {status}: {data}"
        print("[PASS] 5. Exact aud contains 'railopt-web' -> 200 OK")

    # ── 4. Cryptographic Signature & Issuer Validation ─────────────
    # Forged signature
    fake_token = jwt.encode(
        {"sub": "attacker", "realm_access": {"roles": ["ADMIN"]}, "exp": time.time() + 3600, "iss": f"{KEYCLOAK_URL}/realms/{REALM}", "azp": CLIENT_ID},
        "wrong_secret_key",
        algorithm="HS256",
    )
    status, data = await asgi_request(app, "GET", "/api/v1/maintenance-tasks", token=fake_token)
    assert status == 401, f"Expected 401 for forged token, got {status}: {data}"
    print("[PASS] 6. Forged token with invalid signature -> 401 Unauthorized")

    # Wrong issuer
    wrong_iss_claims = dict(real_claims)
    wrong_iss_claims["iss"] = "http://evil-issuer.com/realms/fake"
    with patch.object(jwt, "decode", return_value=wrong_iss_claims):
        status, data = await asgi_request(app, "GET", "/api/v1/maintenance-tasks", token=eng_token)
        assert status == 401, f"Expected 401 for wrong issuer, got {status}: {data}"
        print("[PASS] 7. Wrong issuer -> 401 Unauthorized")

    # Expired token
    with patch("jwt.decode", side_effect=jwt.ExpiredSignatureError("Token has expired")):
        status, data = await asgi_request(app, "GET", "/api/v1/maintenance-tasks", token=eng_token)
        assert status == 401, f"Expected 401 for expired token, got {status}: {data}"
        print("[PASS] 8. Expired token -> 401 Unauthorized")

    # ── 5. Role-Based Access Control (RBAC) ────────────────────────
    # Test allowed role (ENGINEERING) on maintenance endpoint
    status, data = await asgi_request(app, "GET", "/api/v1/maintenance-tasks", token=eng_token)
    assert status == 200, f"Expected 200 for ENGINEERING role, got {status}: {data}"
    print("[PASS] 9. Allowed role (ENGINEERING) -> 200 OK")

    # Test restricted endpoint (ADMIN only) with VIEWER token -> 403 Forbidden
    test_router = APIRouter(prefix="/test-admin-gate", tags=["Test"])
    @test_router.get("")
    async def admin_gate(current_user: User = Depends(require_roles("ADMIN"))):
        return {"status": "ok", "user": current_user.username}

    app.include_router(test_router)

    status_403, data_403 = await asgi_request(app, "GET", "/test-admin-gate", token=viewer_token)
    assert status_403 == 403, f"Expected 403 Forbidden for VIEWER, got {status_403}: {data_403}"
    print("[PASS] 10. Disallowed role (VIEWER accessing ADMIN-only endpoint) -> 403 Forbidden")

    status_200, data_200 = await asgi_request(app, "GET", "/test-admin-gate", token=admin_token)
    assert status_200 == 200, f"Expected 200 for ADMIN, got {status_200}: {data_200}"
    print("[PASS] 11. Allowed role (ADMIN accessing ADMIN-only endpoint) -> 200 OK")

    # ── 6. Public Endpoints Regression ─────────────────────────────
    status, data = await asgi_request(app, "GET", "/health")
    assert status == 200 and data["status"] == "ok"
    print("[PASS] 12. Public GET /health -> 200 OK")

    status, data = await asgi_request(app, "GET", "/api/v1/sections")
    assert status == 200 and data["total"] == 9
    print("[PASS] 13. Public GET /api/v1/sections -> 200 OK")

    status, data = await asgi_request(app, "GET", "/api/v1/stations")
    assert status == 200 and data["total"] == 37
    print("[PASS] 14. Public GET /api/v1/stations -> 200 OK")

    status, data = await asgi_request(app, "GET", "/api/v1/assets")
    assert status == 200 and data["total"] == 101
    print("[PASS] 15. Public GET /api/v1/assets -> 200 OK")

    # ── 7. Setup Script Password Handling (Fix 2) ──────────────────
    python_exe = sys.executable
    script_path = str(PROJECT_ROOT / "scripts" / "setup_keycloak.py")

    # Test 7A: Run setup_keycloak without KC_ADMIN_PASSWORD -> must fail with code 1 and clear message
    env_missing_pwd = dict(os.environ)
    env_missing_pwd.pop("KC_ADMIN_PASSWORD", None)
    proc_fail = subprocess.run(
        [python_exe, script_path],
        env=env_missing_pwd,
        capture_output=True,
        text=True,
    )
    assert proc_fail.returncode != 0, "setup_keycloak.py unexpectedly succeeded without KC_ADMIN_PASSWORD!"
    assert "KC_ADMIN_PASSWORD environment variable is missing or empty" in (proc_fail.stderr + proc_fail.stdout)
    print("[PASS] 16. setup_keycloak.py fails loudly when KC_ADMIN_PASSWORD is missing")

    # Test 7B: Run setup_keycloak with KC_ADMIN_PASSWORD -> succeeds cleanly
    env_with_pwd = dict(os.environ)
    env_with_pwd["KC_ADMIN_PASSWORD"] = "admin_dev_password"
    proc_ok = subprocess.run(
        [python_exe, script_path],
        env=env_with_pwd,
        capture_output=True,
        text=True,
    )
    assert proc_ok.returncode == 0, f"setup_keycloak.py failed with valid password: {proc_ok.stderr}"
    output_ok = proc_ok.stdout + proc_ok.stderr
    assert "KEYCLOAK PROVISIONING COMPLETED SUCCESSFULLY" in output_ok, f"Output missing success message: {output_ok}"
    print("[PASS] 17. setup_keycloak.py succeeds cleanly when KC_ADMIN_PASSWORD is provided")

    print("============================================================")
    print("ALL 17 SECURITY FIX & REGRESSION TESTS PASSED!")
    print("============================================================")


if __name__ == "__main__":
    asyncio.run(run_auth_tests())
