"""Keycloak Realm and User Provisioning Script for RailOpt AI.

Connects to the local Keycloak admin REST API and idempotently creates/updates:
- Realm: railopt
- Client: railopt-web
- Roles: ADMIN, PLANNER, ENGINEERING, SNT, TRD, CONTROL, APPROVER, VIEWER
- Demo Test Users for development/testing

Usage:
    python scripts/setup_keycloak.py
"""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path
import sys
import urllib.error
import urllib.parse
import urllib.request

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("railopt.keycloak")

KEYCLOAK_URL = os.getenv("KEYCLOAK_URL", "http://127.0.0.1:8080").rstrip("/")
ADMIN_USERNAME = os.getenv("KC_ADMIN_USER", "admin")

# Enforce explicit KC_ADMIN_PASSWORD without hardcoded defaults
ADMIN_PASSWORD = os.getenv("KC_ADMIN_PASSWORD")
if not ADMIN_PASSWORD or not ADMIN_PASSWORD.strip():
    logger.error("KC_ADMIN_PASSWORD environment variable is missing or empty.")
    raise ValueError(
        "KC_ADMIN_PASSWORD environment variable is missing or empty. "
        "Please set KC_ADMIN_PASSWORD in your environment or .env file."
    )

REALM_NAME = "railopt"
CLIENT_ID = "railopt-web"

ROLES = [
    "ADMIN",
    "PLANNER",
    "ENGINEERING",
    "SNT",
    "TRD",
    "CONTROL",
    "APPROVER",
    "VIEWER",
]

DEMO_PASSWORD = os.getenv("DEMO_USER_PASSWORD", "railopt_demo_2026")

TEST_USERS = [
    {"username": "admin.demo", "email": "admin.demo@railopt.local", "firstName": "Admin", "lastName": "User", "roles": ["ADMIN"]},
    {"username": "planner.demo", "email": "planner.demo@railopt.local", "firstName": "Planner", "lastName": "User", "roles": ["PLANNER"]},
    {"username": "engineering.demo", "email": "engineering.demo@railopt.local", "firstName": "Engineering", "lastName": "Officer", "roles": ["ENGINEERING"]},
    {"username": "snt.demo", "email": "snt.demo@railopt.local", "firstName": "SignalTelecom", "lastName": "Officer", "roles": ["SNT"]},
    {"username": "trd.demo", "email": "trd.demo@railopt.local", "firstName": "Traction", "lastName": "Officer", "roles": ["TRD"]},
    {"username": "control.demo", "email": "control.demo@railopt.local", "firstName": "Section", "lastName": "Controller", "roles": ["CONTROL"]},
    {"username": "approver.demo", "email": "approver.demo@railopt.local", "firstName": "Block", "lastName": "Approver", "roles": ["APPROVER"]},
    {"username": "viewer.demo", "email": "viewer.demo@railopt.local", "firstName": "Guest", "lastName": "Viewer", "roles": ["VIEWER"]},
]


def api_request(
    path: str,
    method: str = "GET",
    token: str | None = None,
    data: dict | list | None = None,
    expected_statuses: tuple[int, ...] = (200, 201, 204),
) -> tuple[int, any]:
    """Perform HTTP request against Keycloak."""
    url = f"{KEYCLOAK_URL}{path}"
    headers = {"Accept": "application/json"}
    body = None

    if token:
        headers["Authorization"] = f"Bearer {token}"

    if data is not None:
        headers["Content-Type"] = "application/json"
        body = json.dumps(data).encode("utf-8")

    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            resp_body = resp.read().decode("utf-8")
            result = json.loads(resp_body) if resp_body else None
            return resp.status, result
    except urllib.error.HTTPError as exc:
        resp_body = exc.read().decode("utf-8")
        result = json.loads(resp_body) if resp_body else None
        if exc.code in expected_statuses:
            return exc.code, result
        raise RuntimeError(f"Keycloak HTTP {exc.code} for {method} {path}: {resp_body}") from exc


def get_admin_token() -> str:
    """Obtain admin OAuth2 access token from master realm."""
    url = f"{KEYCLOAK_URL}/realms/master/protocol/openid-connect/token"
    data = urllib.parse.urlencode({
        "client_id": "admin-cli",
        "username": ADMIN_USERNAME,
        "password": ADMIN_PASSWORD,
        "grant_type": "password",
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


def provision_keycloak():
    """Setup realm, client, roles, and test users."""
    logger.info("Connecting to Keycloak at: %s", KEYCLOAK_URL)
    token = get_admin_token()
    logger.info("Admin authentication successful.")

    # 1. Create or verify Realm
    logger.info("Checking realm '%s'...", REALM_NAME)
    status, realm = api_request(f"/admin/realms/{REALM_NAME}", token=token, expected_statuses=(200, 404))
    if status == 404:
        logger.info("Creating realm '%s'...", REALM_NAME)
        api_request(
            "/admin/realms",
            method="POST",
            token=token,
            data={
                "realm": REALM_NAME,
                "displayName": "RailOpt AI",
                "enabled": True,
                "sslRequired": "none",
                "registrationAllowed": False,
                "resetPasswordAllowed": True,
                "rememberMe": True,
                "accessTokenLifespan": 300,
            },
        )
        logger.info("Realm '%s' created successfully.", REALM_NAME)
    else:
        logger.info("Realm '%s' already exists.", REALM_NAME)

    # 2. Create or verify Client
    logger.info("Checking client '%s'...", CLIENT_ID)
    status, clients = api_request(f"/admin/realms/{REALM_NAME}/clients?clientId={CLIENT_ID}", token=token)
    client_uuid = None
    if clients:
        client_uuid = clients[0]["id"]
        logger.info("Client '%s' exists (id: %s). Updating configuration...", CLIENT_ID, client_uuid)
        api_request(
            f"/admin/realms/{REALM_NAME}/clients/{client_uuid}",
            method="PUT",
            token=token,
            data={
                "clientId": CLIENT_ID,
                "name": "RailOpt Web Client",
                "enabled": True,
                "publicClient": True,
                "standardFlowEnabled": True,
                "directAccessGrantsEnabled": True,
                "redirectUris": ["http://localhost:3000/*", "http://127.0.0.1:3000/*", "http://localhost:8000/*", "http://127.0.0.1:8000/*"],
                "webOrigins": ["+"],
            },
        )
    else:
        logger.info("Creating client '%s'...", CLIENT_ID)
        api_request(
            f"/admin/realms/{REALM_NAME}/clients",
            method="POST",
            token=token,
            data={
                "clientId": CLIENT_ID,
                "name": "RailOpt Web Client",
                "enabled": True,
                "publicClient": True,
                "standardFlowEnabled": True,
                "directAccessGrantsEnabled": True,
                "redirectUris": ["http://localhost:3000/*", "http://127.0.0.1:3000/*", "http://localhost:8000/*", "http://127.0.0.1:8000/*"],
                "webOrigins": ["+"],
            },
        )
        _, clients = api_request(f"/admin/realms/{REALM_NAME}/clients?clientId={CLIENT_ID}", token=token)
        client_uuid = clients[0]["id"]
        logger.info("Client '%s' created (id: %s).", CLIENT_ID, client_uuid)

    # 3. Create Realm Roles
    logger.info("Creating realm roles...")
    status, existing_roles = api_request(f"/admin/realms/{REALM_NAME}/roles", token=token)
    existing_role_names = {r["name"]: r for r in existing_roles}

    for role_name in ROLES:
        if role_name not in existing_role_names:
            logger.info("Creating role '%s'...", role_name)
            api_request(
                f"/admin/realms/{REALM_NAME}/roles",
                method="POST",
                token=token,
                data={"name": role_name, "description": f"RailOpt AI {role_name} Role"},
            )
        else:
            logger.info("Role '%s' already exists.", role_name)

    # Refresh existing roles
    _, existing_roles = api_request(f"/admin/realms/{REALM_NAME}/roles", token=token)
    role_map = {r["name"]: r for r in existing_roles}

    # 4. Create Demo Test Users
    logger.info("Provisioning demo test users...")
    status, existing_users = api_request(f"/admin/realms/{REALM_NAME}/users", token=token)
    existing_user_map = {u["username"]: u for u in existing_users}

    for user_info in TEST_USERS:
        username = user_info["username"]
        if username not in existing_user_map:
            logger.info("Creating user '%s'...", username)
            api_request(
                f"/admin/realms/{REALM_NAME}/users",
                method="POST",
                token=token,
                data={
                    "username": username,
                    "email": user_info["email"],
                    "firstName": user_info["firstName"],
                    "lastName": user_info["lastName"],
                    "enabled": True,
                    "emailVerified": True,
                    "credentials": [
                        {
                            "type": "password",
                            "value": DEMO_PASSWORD,
                            "temporary": False,
                        }
                    ],
                },
            )
            _, users = api_request(f"/admin/realms/{REALM_NAME}/users?username={username}", token=token)
            user_obj = users[0]
        else:
            user_obj = existing_user_map[username]
            # Reset password to ensure test stability
            api_request(
                f"/admin/realms/{REALM_NAME}/users/{user_obj['id']}/reset-password",
                method="PUT",
                token=token,
                data={"type": "password", "value": DEMO_PASSWORD, "temporary": False},
            )

        # Assign user roles
        user_id = user_obj["id"]
        roles_to_assign = [role_map[r] for r in user_info["roles"] if r in role_map]
        if roles_to_assign:
            api_request(
                f"/admin/realms/{REALM_NAME}/users/{user_id}/role-mappings/realm",
                method="POST",
                token=token,
                data=roles_to_assign,
            )
            logger.info("Assigned roles %s to user '%s'.", user_info["roles"], username)

    logger.info("=" * 60)
    logger.info("KEYCLOAK PROVISIONING COMPLETED SUCCESSFULLY!")
    logger.info("Realm: %s | Client: %s | Roles: %s", REALM_NAME, CLIENT_ID, len(ROLES))
    logger.info("=" * 60)


if __name__ == "__main__":
    provision_keycloak()
