"""In-process ASGI test runner for FastAPI endpoints without requiring external network."""

import asyncio
import json
from pathlib import Path
import sys

API_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = API_DIR.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))
sys.path.insert(0, str(API_DIR))

if sys.platform == "win32":
    try:
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    except Exception:
        pass

import os
import urllib.parse
import urllib.request
from app.main import app

KEYCLOAK_URL = os.getenv("KEYCLOAK_URL", "http://127.0.0.1:8080").replace("localhost", "127.0.0.1").rstrip("/")
REALM = "railopt"
CLIENT_ID = "railopt-web"
DEMO_PASSWORD = os.getenv("DEMO_USER_PASSWORD", "railopt_demo_2026")


def obtain_demo_token(username: str = "engineering.demo") -> str | None:
    """Acquire real JWT access token from Keycloak for testing."""
    url = f"{KEYCLOAK_URL}/realms/{REALM}/protocol/openid-connect/token"
    data = urllib.parse.urlencode({
        "client_id": CLIENT_ID,
        "username": username,
        "password": DEMO_PASSWORD,
        "grant_type": "password",
        "scope": "openid profile email",
    }).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            res = json.loads(resp.read().decode("utf-8"))
            return res["access_token"]
    except Exception:
        return None


async def asgi_request(
    app,
    method: str,
    path: str,
    query_string: str = "",
    token: str | None = None,
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


async def run_all_tests():
    print("Running in-process ASGI tests against RailOpt AI API...")

    # 1. Health
    status, data = await asgi_request(app, "GET", "/health")
    assert status == 200 and data["status"] == "ok", f"Health failed: {status}, {data}"
    print("[PASS] GET /health")

    status, data = await asgi_request(app, "GET", "/health/db")
    assert status == 200 and data["status"] == "ok" and data["database"] == "connected", f"DB health failed: {status}, {data}"
    print("[PASS] GET /health/db")

    # 2. Sections
    status, data = await asgi_request(app, "GET", "/api/v1/sections")
    assert status == 200 and data["total"] == 9, f"Sections list failed: {data}"
    print(f"[PASS] GET /api/v1/sections (total={data['total']})")

    status, data = await asgi_request(app, "GET", "/api/v1/sections/HOW_SEC_001")
    assert status == 200 and data["section_id"] == "HOW_SEC_001", f"Section get failed: {data}"
    print("[PASS] GET /api/v1/sections/HOW_SEC_001")

    status, data = await asgi_request(app, "GET", "/api/v1/sections/INVALID_SEC")
    assert status == 404, f"Expected 404 for invalid section, got {status}"
    print("[PASS] GET /api/v1/sections/INVALID_SEC (404)")

    # 3. Stations
    status, data = await asgi_request(app, "GET", "/api/v1/stations", "page_size=50")
    assert status == 200 and data["total"] == 37, f"Stations list failed: {data}"
    print(f"[PASS] GET /api/v1/stations (total={data['total']})")

    status, data = await asgi_request(app, "GET", "/api/v1/stations/HWH")
    assert status == 200 and data["station_code"] == "HWH" and data["station_name"] == "Howrah Junction", f"Station get failed: {data}"
    print("[PASS] GET /api/v1/stations/HWH")

    status, data = await asgi_request(app, "GET", "/api/v1/stations", "section_id=HOW_SEC_001")
    assert status == 200 and data["total"] == 6, f"Station section filter failed: {data}"
    print(f"[PASS] GET /api/v1/stations?section_id=HOW_SEC_001 (mapped count={data['total']})")

    # Token setup for authenticated routes
    token = obtain_demo_token("engineering.demo")
    from unittest.mock import patch
    import jwt

    mock_payload = {
        "sub": "eng-1",
        "preferred_username": "engineering.demo",
        "email": "engineering@railopt.demo",
        "given_name": "Engineering",
        "family_name": "User",
        "realm_access": {"roles": ["ENGINEERING", "PLANNER", "ADMIN"]},
        "roles": ["ENGINEERING", "PLANNER", "ADMIN"],
    }
    mock_token = jwt.encode(mock_payload, "secret-key", algorithm="HS256")
    auth_token = token or mock_token
    with patch("app.core.security.token_verifier.verify_token") as mock_verify:
        mock_verify.return_value = mock_payload

        # 4. Assets
        status, data = await asgi_request(app, "GET", "/api/v1/assets", "page_size=100", token=auth_token)
        assert status == 200 and data["total"] == 101, f"Assets list failed: {data}"
        print(f"[PASS] GET /api/v1/assets (total={data['total']})")

        status, data = await asgi_request(app, "GET", "/api/v1/assets", "department=Engineering&asset_type=Track", token=auth_token)
        assert status == 200 and data["total"] > 0, f"Asset filter failed: {data}"
        print(f"[PASS] GET /api/v1/assets?department=Engineering&asset_type=Track (filtered count={data['total']})")

        status, data = await asgi_request(app, "GET", "/api/v1/assets/TRK-HWH-01", token=auth_token)
        assert status == 200 and data["asset_id"] == "TRK-HWH-01", f"Asset get failed: {data}"
        print("[PASS] GET /api/v1/assets/TRK-HWH-01")

        # 5. Maintenance Tasks
        status, data = await asgi_request(app, "GET", "/api/v1/maintenance-tasks", "page_size=100", token=auth_token)
        assert status == 200 and data["total"] == 53, f"Maintenance list failed: {data}"
        print(f"[PASS] GET /api/v1/maintenance-tasks (total={data['total']})")

        status, data = await asgi_request(app, "GET", "/api/v1/maintenance-tasks", "department=S%26T", token=auth_token)
        assert status == 200 and data["total"] > 0, f"Maintenance dept filter failed: {data}"
        print(f"[PASS] GET /api/v1/maintenance-tasks?department=S&T (count={data['total']})")

        status, data = await asgi_request(app, "GET", "/api/v1/maintenance-tasks", "severity=Critical", token=auth_token)
        assert status == 200 and data["total"] > 0, f"Maintenance severity filter failed: {data}"
        print(f"[PASS] GET /api/v1/maintenance-tasks?severity=Critical (count={data['total']})")

        status, data = await asgi_request(app, "GET", "/api/v1/maintenance-tasks/WO-0001", token=auth_token)
        assert status == 200 and data["task_id"] == "WO-0001", f"Maintenance get failed: {data}"
        print("[PASS] GET /api/v1/maintenance-tasks/WO-0001")

        # 6. Pagination & Validation
        status, data = await asgi_request(app, "GET", "/api/v1/assets", "page=1&page_size=10", token=auth_token)
        assert status == 200 and data["total_pages"] == 11 and len(data["items"]) == 10, f"Pagination failed: {data}"
        print("[PASS] Pagination math (total=101, page_size=10 -> total_pages=11)")

        status, data = await asgi_request(app, "GET", "/api/v1/assets", "page=0", token=auth_token)
        assert status == 422, f"Expected 422 for page=0, got {status}"
        print("[PASS] Input validation (page=0 -> 422)")

        status, data = await asgi_request(app, "GET", "/api/v1/assets", "page_size=500", token=auth_token)
        assert status == 422, f"Expected 422 for page_size=500, got {status}"
        print("[PASS] Input validation (page_size=500 -> 422)")

    print("\nALL 16 ASGI DIRECT TESTS PASSED SUCCESSFULLY!")


if __name__ == "__main__":
    asyncio.run(run_all_tests())
