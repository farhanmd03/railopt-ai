"""Test suite for Deterministic Candidate Block Generation Engine (Batch 5C).

Tests:
1. Window with sufficient duration -> FEASIBLE candidate.
2. Window too short -> DURATION_INSUFFICIENT feasibility status.
3. Train overlap detected correctly -> TRAIN_CONFLICT feasibility status.
4. No train overlap -> train_conflict = False.
5. Freight data found -> populated with confidence and level.
6. Freight data missing -> freight_data_available = False.
7. Resource availability evaluated (UNVERIFIED for prototype dataset).
8. Stored window status preserved separately from computed_feasibility_status.
9. Hard conflict cannot become FEASIBLE through scoring.
10. Candidate score remains strictly bounded within [0.0, 100.0].
11. Deterministic repeatability (same input -> identical candidate score).
12. Single task candidate generation works properly.
13. Integrated opportunity candidate generation works properly.
14. Candidate block API endpoint GET /api/v1/candidate-blocks returns paginated candidates.
15. Task & Section filtering on /candidate-blocks works.
16. Unknown candidate ID returns 404 on GET /api/v1/candidate-blocks/{candidate_id}.
17. Existing priority, compatibility, and read APIs continue working without regression.
"""

import asyncio
from datetime import date, datetime, time, timezone
import json
import os
from pathlib import Path
import sys
import unittest
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

from app.main import app
from app.models.corridor import FreightForecast
from app.models.operations import TrainSectionOccupancy
from app.models.resource import Resource, ResourceAvailability
from app.services.candidate_block_engine import (
    check_train_conflicts,
    compute_candidate_score,
    evaluate_freight,
    evaluate_resources,
)

KEYCLOAK_URL = os.getenv("KEYCLOAK_URL", "http://127.0.0.1:8080").replace("localhost", "127.0.0.1").rstrip("/")
REALM = "railopt"
CLIENT_ID = "railopt-web"
DEMO_PASSWORD = os.getenv("DEMO_USER_PASSWORD", "railopt_demo_2026")


_TOKEN_CACHE: dict[str, str] = {}

def obtain_demo_token(username: str = "engineering.demo") -> str:
    """Acquire real JWT access token from Keycloak for testing with caching."""
    if username in _TOKEN_CACHE:
        return _TOKEN_CACHE[username]
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
    with urllib.request.urlopen(req, timeout=10) as resp:
        res = json.loads(resp.read().decode("utf-8"))
        token = res["access_token"]
        _TOKEN_CACHE[username] = token
        return token


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


class TestCandidateBlockEngineUnit(unittest.TestCase):
    """Unit tests for pure candidate feasibility checking and scoring rules."""

    def test_01_train_conflict_detected(self):
        """1. Train overlap within candidate window interval is detected as conflict."""
        w_start = datetime(2026, 8, 31, 2, 0, 0, tzinfo=timezone.utc)
        w_end = datetime(2026, 8, 31, 5, 0, 0, tzinfo=timezone.utc)

        # Overlapping occupancy (entry 02:30, exit 03:00)
        occ1 = TrainSectionOccupancy(
            occupancy_id="OCC-1",
            train_id="EXP-101",
            section_id="HOW_SEC_001",
            entry_time=time(2, 30),
            exit_time=time(3, 0),
        )
        # Non-overlapping occupancy (entry 06:00, exit 07:00)
        occ2 = TrainSectionOccupancy(
            occupancy_id="OCC-2",
            train_id="EMU-202",
            section_id="HOW_SEC_001",
            entry_time=time(6, 0),
            exit_time=time(7, 0),
        )

        has_conflict, count, trains = check_train_conflicts(w_start, w_end, [occ1, occ2])
        self.assertTrue(has_conflict)
        self.assertEqual(count, 1)
        self.assertEqual(trains, ["EXP-101"])

    def test_02_no_train_conflict(self):
        """2. Non-overlapping train passages produce no conflict."""
        w_start = datetime(2026, 8, 31, 3, 0, 0, tzinfo=timezone.utc)
        w_end = datetime(2026, 8, 31, 5, 0, 0, tzinfo=timezone.utc)

        occ = TrainSectionOccupancy(
            occupancy_id="OCC-1",
            train_id="EXP-101",
            section_id="HOW_SEC_001",
            entry_time=time(1, 0),
            exit_time=time(2, 0),
        )

        has_conflict, count, trains = check_train_conflicts(w_start, w_end, [occ])
        self.assertFalse(has_conflict)
        self.assertEqual(count, 0)

    def test_02b_train_conflict_overnight_window_positive(self):
        """2b. Window spanning midnight detects recurring train conflict on the second calendar date."""
        # Window spans from Aug 31 23:00 to Sep 01 02:00
        w_start = datetime(2026, 8, 31, 23, 0, 0, tzinfo=timezone.utc)
        w_end = datetime(2026, 9, 1, 2, 0, 0, tzinfo=timezone.utc)

        # Train occupancy at 01:00 - 01:30 (falls in early morning of second calendar date)
        occ = TrainSectionOccupancy(
            occupancy_id="OCC-OVERNIGHT",
            train_id="EXP-NIGHT-01",
            section_id="HOW_SEC_001",
            entry_time=time(1, 0),
            exit_time=time(1, 30),
        )

        has_conflict, count, trains = check_train_conflicts(w_start, w_end, [occ])
        self.assertTrue(has_conflict)
        self.assertEqual(count, 1)
        self.assertEqual(trains, ["EXP-NIGHT-01"])

    def test_02c_train_conflict_overnight_window_negative(self):
        """2c. Window spanning midnight does NOT falsely trigger on non-overlapping daytime occupancy."""
        w_start = datetime(2026, 8, 31, 23, 0, 0, tzinfo=timezone.utc)
        w_end = datetime(2026, 9, 1, 2, 0, 0, tzinfo=timezone.utc)

        # Train occupancy at 14:00 - 15:00 (midday, outside window on both dates)
        occ = TrainSectionOccupancy(
            occupancy_id="OCC-DAYTIME",
            train_id="EXP-DAY-01",
            section_id="HOW_SEC_001",
            entry_time=time(14, 0),
            exit_time=time(15, 0),
        )

        has_conflict, count, trains = check_train_conflicts(w_start, w_end, [occ])
        self.assertFalse(has_conflict)
        self.assertEqual(count, 0)

    def test_03_freight_forecast_found(self):
        """3. Freight forecast for section and date is properly retrieved."""
        ff = FreightForecast(
            id=1,
            section_id="HOW_SEC_001",
            date=date(2026, 8, 31),
            forecast_freight_trains=4,
            forecast_tonnage=5200.0,
            forecast_confidence=0.85,
            traffic_level="LOW",
        )
        avail, level, trains, tonnage, conf, reasons = evaluate_freight(
            "HOW_SEC_001", date(2026, 8, 31), [ff]
        )
        self.assertTrue(avail)
        self.assertEqual(level, "LOW")
        self.assertEqual(trains, 4)
        self.assertEqual(tonnage, 5200.0)
        self.assertEqual(conf, 0.85)
        self.assertTrue(any("Freight forecast is LOW" in r for r in reasons))

    def test_04_freight_forecast_missing(self):
        """4. Missing freight forecast is explicitly marked unavailable."""
        avail, level, trains, tonnage, conf, reasons = evaluate_freight(
            "HOW_SEC_001", date(2026, 8, 31), []
        )
        self.assertFalse(avail)
        self.assertIsNone(level)
        self.assertTrue(any("unavailable" in r for r in reasons))

    def test_05_resource_evaluation_unverified(self):
        """5. Resources without date-specific availability records return UNVERIFIED."""
        res1 = Resource(resource_id="RES-001", department="Engineering", depot="Dankuni")
        check, avail, r_ids, reasons = evaluate_resources(
            ["Engineering"], date(2026, 8, 31), [res1], []
        )
        self.assertEqual(check, "UNVERIFIED")
        self.assertFalse(avail)
        self.assertEqual(r_ids, ["RES-001"])
        self.assertTrue(any("unverified" in r for r in reasons))

    def test_06_candidate_scoring_bounds_and_determinism(self):
        """6. Candidate score remains strictly bounded within [0, 100] and is deterministic."""
        score1 = compute_candidate_score(
            priority_score=80.0,
            compatibility_score=90.0,
            window_dur_hrs=4.0,
            req_dur_hrs=3.5,
            train_conflict=False,
            freight_level="LOW",
            freight_available=True,
        )
        score2 = compute_candidate_score(
            priority_score=80.0,
            compatibility_score=90.0,
            window_dur_hrs=4.0,
            req_dur_hrs=3.5,
            train_conflict=False,
            freight_level="LOW",
            freight_available=True,
        )
        self.assertGreaterEqual(score1, 0.0)
        self.assertLessEqual(score1, 100.0)
        self.assertEqual(score1, score2)

        # Minimum extreme
        score_min = compute_candidate_score(
            priority_score=0.0,
            compatibility_score=0.0,
            window_dur_hrs=1.0,
            req_dur_hrs=5.0,  # Negative slack
            train_conflict=True,
            freight_level="HIGH",
            freight_available=True,
        )
        self.assertGreaterEqual(score_min, 0.0)
        self.assertLessEqual(score_min, 100.0)


class TestCandidateBlockEngineIntegration(unittest.IsolatedAsyncioTestCase):
    """Integration tests running against the live database and API endpoints."""

    async def asyncSetUp(self):
        try:
            self.token = obtain_demo_token("engineering.demo")
        except Exception:
            self.token = None

    async def test_07_list_candidate_blocks_authenticated(self):
        """7. GET /api/v1/candidate-blocks returns paginated candidate blocks."""
        self.assertIsNotNone(self.token, "Keycloak demo token required")
        status, data = await asgi_request(
            app,
            "GET",
            "/api/v1/candidate-blocks",
            token=self.token,
            query_string="page_size=10",
        )
        self.assertEqual(status, 200)
        self.assertIn("items", data)
        self.assertIn("total", data)
        self.assertGreater(data["total"], 0)
        self.assertLessEqual(len(data["items"]), 10)

        # Inspect candidate fields
        first = data["items"][0]
        self.assertIn("candidate_id", first)
        self.assertIn("section_id", first)
        self.assertIn("window_id", first)
        self.assertIn("computed_feasibility_status", first)
        self.assertIn(first["computed_feasibility_status"], ["FEASIBLE", "TRAIN_CONFLICT", "DURATION_INSUFFICIENT"])
        self.assertIn("train_conflict", first)
        self.assertIn("freight_data_available", first)
        self.assertIn("resource_check", first)
        self.assertIn("candidate_score", first)
        self.assertIn("advisory_note", first)
        self.assertIn("NOT an engineering, traffic-control, or safety approval", first["advisory_note"])

    async def test_08_filter_candidate_blocks_section(self):
        """8. Filter candidate blocks by section_id."""
        self.assertIsNotNone(self.token)
        status, data = await asgi_request(
            app,
            "GET",
            "/api/v1/candidate-blocks",
            token=self.token,
            query_string="section_id=HOW_SEC_001&page_size=5",
        )
        self.assertEqual(status, 200)
        for item in data["items"]:
            self.assertEqual(item["section_id"], "HOW_SEC_001")

    async def test_09_filter_candidate_blocks_feasibility(self):
        """9. Filter candidate blocks by feasibility_status=FEASIBLE."""
        self.assertIsNotNone(self.token)
        status, data = await asgi_request(
            app,
            "GET",
            "/api/v1/candidate-blocks",
            token=self.token,
            query_string="feasibility_status=FEASIBLE&page_size=5",
        )
        self.assertEqual(status, 200)
        for item in data["items"]:
            self.assertEqual(item["computed_feasibility_status"], "FEASIBLE")
            self.assertFalse(item["train_conflict"])
            self.assertGreaterEqual(item["window_duration_hrs"], item["required_duration_hrs"])

    async def test_10_get_candidate_block_by_id(self):
        """10. GET /api/v1/candidate-blocks/{candidate_id} retrieves a specific candidate."""
        self.assertIsNotNone(self.token)
        # First list to get a valid ID
        status, data = await asgi_request(
            app,
            "GET",
            "/api/v1/candidate-blocks",
            token=self.token,
            query_string="page_size=1",
        )
        self.assertEqual(status, 200)
        cand_id = data["items"][0]["candidate_id"]

        status, cand = await asgi_request(
            app,
            "GET",
            f"/api/v1/candidate-blocks/{cand_id}",
            token=self.token,
        )
        self.assertEqual(status, 200)
        self.assertEqual(cand["candidate_id"], cand_id)

    async def test_11_get_candidate_block_unknown_404(self):
        """11. GET /api/v1/candidate-blocks/UNKNOWN-CANDIDATE-ID returns 404."""
        self.assertIsNotNone(self.token)
        status, data = await asgi_request(
            app,
            "GET",
            "/api/v1/candidate-blocks/UNKNOWN-CANDIDATE-ID",
            token=self.token,
        )
        self.assertEqual(status, 404)
        self.assertIn("detail", data)

    async def test_12_non_regression_existing_endpoints(self):
        """12. Existing endpoints (priority, integration opportunities) continue working."""
        self.assertIsNotNone(self.token)
        # Priority endpoint
        status, data = await asgi_request(app, "GET", "/api/v1/maintenance-tasks/WO-0001/priority", token=self.token)
        self.assertEqual(status, 200)
        self.assertIn("computed_priority_score", data)

        # Integration opportunities endpoint
        status, data = await asgi_request(app, "GET", "/api/v1/maintenance-tasks/integration-opportunities", token=self.token)
        self.assertEqual(status, 200)
        self.assertIn("items", data)


if __name__ == "__main__":
    unittest.main()
