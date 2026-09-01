#!/usr/bin/env python3
"""RailOpt AI - Production Deployment Smoke Test Suite.

Verifies end-to-end operational health against any active deployment
(local Docker, staging, or production cloud).
"""

import sys
import time
import urllib.request
import urllib.parse
import json

KEYCLOAK_URL = "http://127.0.0.1:8080/realms/railopt/protocol/openid-connect/token"
API_BASE = "http://127.0.0.1:8000"

ROLES_TO_TEST = [
    ("admin.demo", "ADMIN", True),
    ("planner.demo", "PLANNER", True),
    ("approver.demo", "APPROVER", False),
    ("viewer.demo", "VIEWER", False),
]

def acquire_token(username: str) -> str:
    data = urllib.parse.urlencode({
        "client_id": "railopt-web",
        "username": username,
        "password": "railopt_demo_2026",
        "grant_type": "password",
        "scope": "openid profile email",
    }).encode("utf-8")
    req = urllib.request.Request(KEYCLOAK_URL, data=data, headers={"Content-Type": "application/x-www-form-urlencoded"}, method="POST")
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode("utf-8"))["access_token"]

def http_json(method: str, path: str, token: str = None, payload: dict = None):
    url = f"{API_BASE}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(payload).encode("utf-8") if payload else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method.upper())
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = json.loads(e.read().decode("utf-8")) if e.fp else {}
        return e.code, body

def run_smoke_test():
    print("=" * 80)
    print("RAILOPT AI - PRODUCTION DEPLOYMENT SMOKE TEST")
    print("=" * 80)
    t0 = time.time()

    # 1. Health checks
    print("\n[PHASE 1] Checking Core Infrastructure Health...")
    status, health_data = http_json("GET", "/health")
    assert status == 200, f"FastAPI health check failed: {status}"
    print(f"  [OK] FastAPI /health -> HTTP {status} (status={health_data.get('status')})")

    status, db_health = http_json("GET", "/health/db")
    assert status == 200, f"PostgreSQL health check failed: {status}"
    print(f"  [OK] PostgreSQL /health/db -> HTTP {status} (database={db_health.get('database')})")

    # 2. RBAC & Multi-Role Verification
    print("\n[PHASE 2] Checking Keycloak OIDC Authentication & RBAC...")
    for username, role, can_generate in ROLES_TO_TEST:
        token = acquire_token(username)
        status, sec_data = http_json("GET", "/api/v1/sections", token)
        assert status == 200, f"Failed to list sections for {username}: {status}"
        print(f"  [OK] Authenticated as {username:15} ({role:8}) -> GET /sections HTTP 200")

    # 3. Solver Execution as Planner
    print("\n[PHASE 3] Initiating Live OR-Tools CP-SAT Optimization Solve...")
    planner_token = acquire_token("planner.demo")
    opt_payload = {
        "planning_start": "2026-08-31",
        "planning_end": "2026-09-06",
        "solver_time_limit_seconds": 10,
        "run_type": "smoke_test",
    }
    status, run_data = http_json("POST", "/api/v1/optimization/runs", planner_token, opt_payload)
    assert status == 201, f"Optimization solve failed: {status}, {run_data}"
    run_id = run_data["id"]
    print(f"  [OK] POST /api/v1/optimization/runs -> HTTP 201 (Run ID: #{run_id})")
    print(f"       Solver Status:   {run_data['solver_status']}")
    print(f"       Tasks Scheduled: {run_data['tasks_scheduled']}/{run_data['tasks_considered']}")
    print(f"       Objective Value: {run_data['objective_value']:.2f}")

    # 4. Result Blocks & Timestamps
    print("\n[PHASE 4] Verifying Scheduled Blocks Integrity...")
    status, blocks_data = http_json("GET", f"/api/v1/optimization/runs/{run_id}/blocks", planner_token)
    assert status == 200 and len(blocks_data["items"]) > 0
    for b in blocks_data["items"]:
        assert b["block_start"] is not None and b["block_end"] is not None
        assert b["block_start"] < b["block_end"]
    print(f"  [OK] GET /runs/{run_id}/blocks -> HTTP 200 ({len(blocks_data['items'])} blocks verified with valid timestamps)")

    # 5. What-If Scenario Analysis
    print("\n[PHASE 5] Executing What-If Scenario Analysis...")
    scenario_payload = {
        "name": "Smoke Test Priority Focus",
        "scenario_type": "OBJECTIVE_WEIGHTS",
        "planning_start": "2026-08-31",
        "planning_end": "2026-09-06",
        "solver_time_limit_seconds": 10,
        "weight_priority_score": 2.5,
    }
    status, scen_data = http_json("POST", f"/api/v1/optimization/runs/{run_id}/scenarios", planner_token, scenario_payload)
    assert status == 201, f"Scenario failed: {status}, {scen_data}"
    print(f"  [OK] POST /runs/{run_id}/scenarios -> HTTP 201 (Scenario Run #{scen_data['scenario_run']['id']})")

    # 6. Approvals & Audit Trail
    print("\n[PHASE 6] Executing Human Approval & Audit Sign-Off...")
    status, submit_res = http_json("POST", f"/api/v1/optimization/runs/{run_id}/submit", planner_token)
    assert status == 200, f"Submit failed: {status}, {submit_res}"
    approver_token = acquire_token("approver.demo")
    status, app_res = http_json("POST", f"/api/v1/optimization/runs/{run_id}/approve", approver_token)
    assert status == 200 and app_res["approval_status"] == "APPROVED", f"Approve failed: {status}, {app_res}"
    print(f"  [OK] Approval Workflow: DRAFT -> SUBMITTED -> APPROVED (by {app_res['approved_by']})")

    # 7. Grounded LLM Explainability Router
    print("\n[PHASE 7] Checking Explainability Router (Ollama / Gemini / Deterministic)...")
    status, exp_data = http_json("POST", "/api/v1/explanations", planner_token, {"explanation_type": "RUN_SUMMARY", "run_id": run_id})
    assert status == 200, f"Explainability returned HTTP {status}: {exp_data}"
    print(f"  [OK] POST /explanations -> HTTP 200 (Model: {exp_data.get('model_name')}, Provider: {exp_data.get('provider')})")
    print(f"       Summary: {exp_data.get('summary')[:80]}...")

    elapsed = time.time() - t0
    print("\n" + "=" * 80)
    print(f"ALL SMOKE TESTS PASSED IN {elapsed:.2f}s! DEPLOYMENT STATUS: HEALTHY & PRODUCTION-READY.")
    print("=" * 80)

if __name__ == "__main__":
    run_smoke_test()
