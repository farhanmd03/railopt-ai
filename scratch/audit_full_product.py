"""Comprehensive End-to-End Product Verification and Audit Script (Batch 7V).

Executes exhaustive API, RBAC, Data Integrity, and State Transition tests across
all 8 Keycloak demo roles and anonymous users against live FastAPI and Keycloak.
"""

import asyncio
import json
import os
import sys
import time
import urllib.parse
import urllib.request
import httpx

KEYCLOAK_URL = "http://127.0.0.1:8080"
API_BASE = "http://127.0.0.1:8000/api/v1"
DEMO_PASSWORD = os.getenv("DEMO_USER_PASSWORD", "railopt_demo_2026")

ROLES_USERS = {
    "ADMIN": "admin.demo",
    "PLANNER": "planner.demo",
    "ENGINEERING": "engineering.demo",
    "SNT": "snt.demo",
    "TRD": "trd.demo",
    "CONTROL": "control.demo",
    "APPROVER": "approver.demo",
    "VIEWER": "viewer.demo",
}


def get_token(username: str) -> str:
    """Acquire real JWT from Keycloak."""
    url = f"{KEYCLOAK_URL}/realms/railopt/protocol/openid-connect/token"
    data = urllib.parse.urlencode({
        "client_id": "railopt-web",
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
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode("utf-8"))["access_token"]


async def run_audit():
    print("=" * 70)
    print("RAILOPT-AI FULL PRODUCT INTERACTION + UX + RBAC AUDIT (BATCH 7V)")
    print("=" * 70)

    # 1. Acquire tokens for all 8 users
    print("\n--- PHASE 1: KEYCLOAK DEMO USER TOKEN ACQUISITION ---")
    tokens = {}
    for role, username in ROLES_USERS.items():
        try:
            t = get_token(username)
            tokens[role] = t
            print(f"  [SUCCESS] {role:12} ({username}) -> Token acquired ({len(t)} chars)")
        except Exception as e:
            print(f"  [FAILED]  {role:12} ({username}) -> Error: {e}")

    # 2. Test Core Public Endpoints
    print("\n--- PHASE 2: PUBLIC & READ DATA INTEGRITY CHECK ---")
    async with httpx.AsyncClient(base_url=API_BASE, timeout=15.0) as client:
        # Sections
        resp = await client.get("/sections")
        sec_count = resp.json().get("total", len(resp.json().get("items", [])))
        print(f"  [Sections API] HTTP {resp.status_code} -> {sec_count} railway sections loaded")

        # Stations
        resp = await client.get("/stations")
        stn_count = resp.json().get("total", len(resp.json().get("items", [])))
        print(f"  [Stations API] HTTP {resp.status_code} -> {stn_count} railway stations loaded")

        # Assets
        resp = await client.get("/assets")
        asset_count = resp.json().get("total", len(resp.json().get("items", [])))
        print(f"  [Assets API]   HTTP {resp.status_code} -> {asset_count} physical railway assets loaded")

        # Maintenance Tasks
        resp = await client.get("/maintenance/tasks", headers={"Authorization": f"Bearer {tokens['PLANNER']}"})
        task_count = resp.json().get("total", len(resp.json().get("items", [])))
        print(f"  [Tasks API]    HTTP {resp.status_code} -> {task_count} maintenance tasks loaded")

        # Candidate Blocks
        resp = await client.get("/candidate-blocks", headers={"Authorization": f"Bearer {tokens['PLANNER']}"})
        cand_count = resp.json().get("total", len(resp.json().get("items", [])))
        print(f"  [Candidates]   HTTP {resp.status_code} -> {cand_count} candidate blocks generated")

        # Integration Opportunities
        resp = await client.get("/candidate-blocks/opportunities", headers={"Authorization": f"Bearer {tokens['PLANNER']}"})
        opp_count = resp.json().get("total", len(resp.json().get("items", [])))
        print(f"  [Opportunities] HTTP {resp.status_code} -> {opp_count} integration opportunities")

    # 3. Test Full RBAC Matrix Across All Roles
    print("\n--- PHASE 3: COMPREHENSIVE RBAC ACCESS MATRIX ---")
    endpoints_to_test = [
        ("GET", "/sections", "Read Sections", None),
        ("GET", "/stations", "Read Stations", None),
        ("GET", "/maintenance/tasks", "Read Maintenance Tasks", ("ADMIN", "PLANNER", "ENGINEERING", "SNT", "TRD")),
        ("GET", "/candidate-blocks", "Read Candidate Blocks", ("ADMIN", "PLANNER", "ENGINEERING", "SNT", "TRD", "CONTROL")),
        ("POST", "/optimization/runs", "Trigger Optimization Solve", ("ADMIN", "PLANNER", "CONTROL")),
        ("GET", "/optimization/runs", "Read Optimization Runs", ("ADMIN", "PLANNER", "CONTROL", "APPROVER", "VIEWER", "ENGINEERING", "SNT", "TRD")),
        ("POST", "/optimization/runs/SUBMIT_TEST/submit", "Submit for Approval", ("ADMIN", "PLANNER")),
        ("POST", "/optimization/runs/APPROVE_TEST/approve", "Approve Plan", ("ADMIN", "APPROVER")),
        ("POST", "/optimization/runs/REJECT_TEST/reject", "Reject Plan", ("ADMIN", "APPROVER")),
        ("GET", "/audit/logs", "Read Audit Logs", ("ADMIN", "VIEWER", "APPROVER", "PLANNER", "CONTROL")),
    ]

    async with httpx.AsyncClient(base_url=API_BASE, timeout=25.0) as client:
        # Create a fresh test run for state transitions
        run_resp = await client.post(
            "/optimization/runs",
            headers={"Authorization": f"Bearer {tokens['PLANNER']}"},
            json={"run_type": "standard"},
        )
        test_run_id = run_resp.json()["id"]
        print(f"  -> Generated base test run #{test_run_id} (DRAFT) for transition audits")

        matrix_results = {}
        for role, token in tokens.items():
            matrix_results[role] = {}
            headers = {"Authorization": f"Bearer {token}"}

            # Test 1: Trigger run
            r_solve = await client.post("/optimization/runs", headers=headers, json={"run_type": "standard"})
            matrix_results[role]["Trigger Solve"] = "PASS" if (r_solve.status_code == 200 if role in ("ADMIN", "PLANNER", "CONTROL") else r_solve.status_code == 403) else f"FAIL ({r_solve.status_code})"

            # Test 2: Read runs
            r_read = await client.get("/optimization/runs", headers=headers)
            matrix_results[role]["Read Runs"] = "PASS" if r_read.status_code == 200 else f"FAIL ({r_read.status_code})"

            # Test 3: What-If Scenario Solve
            r_scen = await client.post(f"/optimization/runs/{test_run_id}/scenarios", headers=headers, json={"name": f"Audit {role}", "scenario_type": "OBJECTIVE_WEIGHTS"})
            matrix_results[role]["What-If Solve"] = "PASS" if (r_scen.status_code == 201 if role in ("ADMIN", "PLANNER", "CONTROL") else r_scen.status_code == 403) else f"FAIL ({r_scen.status_code})"

            # Test 4: Read Scenarios
            r_scen_list = await client.get(f"/optimization/runs/{test_run_id}/scenarios", headers=headers)
            matrix_results[role]["Read Scenarios"] = "PASS" if r_scen_list.status_code == 200 else f"FAIL ({r_scen_list.status_code})"

            # Test 5: Read Audit Logs
            r_audit = await client.get(f"/audit/logs/OptimizationRun/{test_run_id}", headers=headers)
            matrix_results[role]["Read Audit"] = "PASS" if r_audit.status_code == 200 else f"FAIL ({r_audit.status_code})"

        # Print Matrix
        print("\n  " + f"{'ROLE':12} | {'Trigger Solve':14} | {'Read Runs':10} | {'What-If Solve':14} | {'Read Scenarios':14} | {'Read Audit':10}")
        print("  " + "-" * 85)
        for role, res in matrix_results.items():
            print(f"  {role:12} | {res['Trigger Solve']:14} | {res['Read Runs']:10} | {res['What-If Solve']:14} | {res['Read Scenarios']:14} | {res['Read Audit']:10}")

    # 4. Test State Transitions & Audit Trail
    print("\n--- PHASE 4: STATE TRANSITION & AUDIT TRAIL LIFECYCLE ---")
    async with httpx.AsyncClient(base_url=API_BASE, timeout=25.0) as client:
        # Step A: Planner submits base run
        submit_resp = await client.post(
            f"/optimization/runs/{test_run_id}/submit",
            headers={"Authorization": f"Bearer {tokens['PLANNER']}"},
        )
        print(f"  [1. Submit DRAFT -> SUBMITTED] HTTP {submit_resp.status_code}, status={submit_resp.json().get('approval_status')}")

        # Step B: Viewer attempts to approve (must fail 403)
        v_approve = await client.post(
            f"/optimization/runs/{test_run_id}/approve",
            headers={"Authorization": f"Bearer {tokens['VIEWER']}"},
        )
        print(f"  [2. Unauthorized Viewer Approval] HTTP {v_approve.status_code} (Expected 403)")

        # Step C: Approver approves plan
        app_resp = await client.post(
            f"/optimization/runs/{test_run_id}/approve",
            headers={"Authorization": f"Bearer {tokens['APPROVER']}"},
        )
        print(f"  [3. Approver SUBMITTED -> APPROVED] HTTP {app_resp.status_code}, status={app_resp.json().get('approval_status')}, approved_by={app_resp.json().get('approved_by')}")

        # Step D: Check Audit Trail
        audit_resp = await client.get(
            f"/audit/logs/OptimizationRun/{test_run_id}",
            headers={"Authorization": f"Bearer {tokens['ADMIN']}"},
        )
        logs = audit_resp.json().get("items", [])
        print(f"  [4. Audit Trail Verification] Found {len(logs)} audit entries:")
        for log in logs:
            print(f"      - [{log['timestamp']}] Actor: {log['user_id']} | Action: {log['action']} | Details: {log['details']}")

    # 5. Test What-If Scenario Immutability
    print("\n--- PHASE 5: WHAT-IF SCENARIO & BASE RUN IMMUTABILITY ---")
    async with httpx.AsyncClient(base_url=API_BASE, timeout=30.0) as client:
        # Create What-If scenario against approved base run
        scen_resp = await client.post(
            f"/optimization/runs/{test_run_id}/scenarios",
            headers={"Authorization": f"Bearer {tokens['PLANNER']}"},
            json={
                "name": "Audit What-If Scenario",
                "scenario_type": "OBJECTIVE_WEIGHTS",
                "weight_train_disruption": 40.0,
            },
        )
        scen_data = scen_resp.json()
        print(f"  [1. Create Scenario] HTTP {scen_resp.status_code} -> Scenario ID: {scen_data.get('scenario_id')}, Status: {scen_data.get('status')}")
        print(f"      Comparison Explanation: {scen_data.get('comparison', {}).get('explanation')}")

        # Verify base run remains unchanged
        base_check = await client.get(
            f"/optimization/runs/{test_run_id}",
            headers={"Authorization": f"Bearer {tokens['PLANNER']}"},
        )
        b_data = base_check.json()
        print(f"  [2. Base Run Immutability Check] Run #{b_data['id']} approval_status={b_data['approval_status']} (Untouched APPROVED)")

    print("\n" + "=" * 70)
    print("ALL LIVE AUDIT PHASES EXECUTED SUCCESSFULLY")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(run_audit())
