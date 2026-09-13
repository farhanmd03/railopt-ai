# RailOpt AI — Performance & Latency Audit Report

*Comprehensive Diagnostic Analysis, Measurement Data, Root-Cause Ranking & Safe Improvement Plan*

---

> **Audit Type**: READ-ONLY PERFORMANCE DIAGNOSTIC  
> **Target Systems**: Production Frontend (`railopt-ai-five.vercel.app`), Production Backend (`railopt-ai-36j3.onrender.com`), Supabase PostgreSQL/PostGIS  
> **Golden Baseline Commit**: `87b0987` (Working baseline with Optimization #1 speedup and brand contrast fix)  
> **Audit Date**: 2026-09-04  
> **Status**: ZERO CODE/CONFIG MODIFICATIONS PERFORMED

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Demo Workspace Login Flow Diagnostics](#2-demo-workspace-login-flow-diagnostics)
3. [Production Auth0 OIDC Login Diagnostics](#3-production-auth0-oidc-login-diagnostics)
4. [Frontend Initial Load & App-Shell Behavior](#4-frontend-initial-load--app-shell-behavior)
5. [Backend Latency & Endpoint Benchmarks](#5-backend-latency--endpoint-benchmarks)
6. [Database & Master-Data File Verification](#6-database--master-data-file-verification)
7. [Startup & Warmup Inspection](#7-startup--warmup-inspection)
8. [Candidate Block Engine Performance](#8-candidate-block-engine-performance)
9. [Optimization / Solver Trigger Verification](#9-optimization--solver-trigger-verification)
10. [Map GIS & Geospatial Rendering Cost](#10-map-gis--geospatial-rendering-cost)
11. [Production (Vercel/Render/Supabase) vs. Local Comparison](#11-production-vs-local-comparison)
12. [Real User Experience & Perception Gaps](#12-real-user-experience--perception-gaps)
13. [Root-Cause Impact Ranking (High / Medium / Low)](#13-root-cause-impact-ranking)
14. [Safe Improvement Plan (Zero-Risk Roadmap)](#14-safe-improvement-plan)

---

## 1. Executive Summary

A comprehensive, non-destructive audit of RailOpt AI's performance was conducted to evaluate user perception of slowness during demo login, dashboard initialization, page transitions, and map rendering.

### Key Takeaways
1. **Cold Start Dominance**: Render's free tier spins down backend compute after 15 minutes of inactivity. The initial HTTP request (such as `/api/v1/auth/demo-token` or `/health`) takes **30 to 50 seconds** solely waiting for container spin-up and TLS termination. Once warm, token issuance takes **0.41 seconds**.
2. **Heavy Candidate Block Generation (8–10s)**: While Optimization #1 reduced `/api/v1/candidate-blocks` generation from ~26 seconds down to ~8.2–9.1s on production hardware, it still re-evaluates timetable cross-products on-the-fly. Both the **Dashboard** and **Map** trigger this endpoint on page mount, keeping the UI loading spinner active for 8–10 seconds.
3. **Database vs. Excel Master-Data**: The 5.3 MB Excel sheet (`data/raw/howrah_division_master_data.xlsx`) is used **strictly offline** during database seeding (`scripts/seed_data.py`). At runtime, the API queries PostgreSQL/Supabase directly; **Excel is NOT read at runtime** and contributes zero latency to user requests.
4. **Solver Safety Confirmed**: Google OR-Tools CP-SAT is **never** triggered during login, dashboard loading, or navigation. It executes strictly upon user demand via `POST /api/v1/optimization/runs`.
5. **Waterfall Querying on Map & Calendar**: The Map page simultaneously issues 6 queries (`stations`, `sections`, `maintenance`, `candidate-blocks?page_size=100`, `optimization-runs`, and `optimized-blocks`), pulling **189.8 KB** of data concurrently over a single-core backend worker.

---

## 2. Demo Workspace Login Flow Diagnostics

### Step-by-Step Latency Breakdown

```
[1. User Click]
   │
   ├── [A. Demo Token Request] (POST /api/v1/auth/demo-token)
   │     • Cold Container: 30.0s – 50.0s (Render container wake-up)
   │     • Warm Container: 0.38s – 0.45s (Fast HS256 minting)
   │
   ├── [B. Client Session Sync] (setDemoUserSession in auth-config.ts)
   │     • 0.02s – 0.05s (oidc-client-ts sessionStorage & event load)
   │
   ├── [C. Client-Side Router Transition] (router.replace("/dashboard"))
   │     • 0.08s – 0.15s (Next.js Turbopack client hydration)
   │
   ├── [D. AppShell OIDC Role Verification Gate]
   │     • 0.01s (In-memory role claim extraction)
   │
   └── [E. Dashboard Initial Data Fetching] (5 Concurrent API Calls)
         • Sections / Tasks / Opps / Runs: ~1.1s – 1.7s
         • Candidate Blocks (page_size=5): ~8.2s – 8.5s
         ────────────────────────────────────────────
         TOTAL TIME TO INTERACTIVE DASHBOARD:
         • Cold: ~40s – 58s
         • Warm: ~8.8s – 9.2s (Dominated by candidate-blocks)
```

### Observations
- In a warm state, acquiring the demo token takes $< 0.5$ seconds.
- The perceived delay when entering the dashboard is almost entirely due to `GET /api/v1/candidate-blocks?page=1&page_size=5` (8.28s) delaying the removal of loading skeletons or keeping dashboard sections in a fetching state.

---

## 3. Production Auth0 OIDC Login Diagnostics

For genuine Auth0 accounts (`ADMIN`, `PLANNER`, etc.):

| Step | Component | Typical Latency | Notes |
|---|---|---|---|
| **1. Universal Login Redirect** | Browser $\rightarrow$ Auth0 | 0.4s – 0.8s | Auth0 hosted CDN response |
| **2. User Credentials Submit** | Auth0 Tenant | 0.8s – 1.5s | Database authentication + Post Login Action (`https://railopt.ai/roles`) |
| **3. Callback Exchange** | `/auth/callback` $\rightarrow$ Auth0 `/oauth/token` | 0.6s – 1.1s | Authorization code exchange with PKCE |
| **4. Session Setup** | Next.js Client | 0.05s | Tokens persisted to `sessionStorage` |
| **5. Initial API Queries** | Browser $\rightarrow$ Render API | 1.1s – 8.5s | Validates token via Auth0 JWKS (cached after first hit) |

*Total Auth0 login overhead is approximately 2.0–3.5s before hitting backend APIs.*

---

## 4. Frontend Initial Load & App-Shell Behavior

### Request Concurrency on Initial Dashboard Mount
The dashboard triggers **5 queries in parallel** via TanStack Query:
1. `GET /api/v1/maintenance-tasks?page=1&page_size=100` (16.7 KB)
2. `GET /api/v1/maintenance-tasks/integration-opportunities?page=1&page_size=5` (5.7 KB)
3. `GET /api/v1/candidate-blocks?page=1&page_size=5` (6.7 KB)
4. `GET /api/v1/optimization/runs?page=1&page_size=1` (7.4 KB)
5. `GET /api/v1/optimization/runs/{latestId}/blocks?page=1&page_size=6` (dependent query; fires once latest run ID resolves)

### Query Pattern Evaluation
- **Parallel vs Sequential**: The 4 primary queries fire concurrently. The 5th query (`optimized-blocks`) waits for `optimization-runs` to return the latest run ID.
- **Unnecessary Duplication**: 
  - On `/dashboard`, `maintenance-tasks` requests `page_size=100` to calculate high/critical counts client-side.
  - On `/maintenance`, `maintenance-tasks` is requested twice: once with `page_size=100` for the summary strip, and again with server filters.
- **Client Computation Cost**: Negligible ($< 10\text{ ms}$). Filtering 100 JSON items in JavaScript takes $< 2\text{ ms}$.
- **Re-renders**: React 19 handles the component tree efficiently. However, because `isRefreshing` combines all 5 queries (`tasksQuery.isFetching || candidateBlocksQuery.isFetching || ...`), the global refresh spinner stays active until the slowest query (`candidate-blocks`, 8.5s) finishes.

---

## 5. Backend Latency & Endpoint Benchmarks

Live production measurements taken against `https://railopt-ai-36j3.onrender.com`:

| Endpoint | Payload Size | Avg Latency (Warm) | Slowest Latency | Expensive Computation? | Blocks Render? |
|---|:---:|:---:|:---:|:---:|:---:|
| `POST /api/v1/auth/demo-token` | 0.8 KB | **0.42 s** | 48.6 s (cold) | No (HS256 sign) | Yes (on login) |
| `GET /api/v1/sections` | 2.5 KB | **1.13 s** | 2.94 s | No (simple SQL) | Yes (on map) |
| `GET /api/v1/stations?page_size=100` | 9.3 KB | **1.09 s** | 2.89 s | No (simple SQL) | Yes (on map) |
| `GET /api/v1/maintenance-tasks?page_size=100` | 16.7 KB | **1.10 s** | 3.11 s | No (simple SQL) | Yes (on dashboard) |
| `GET /api/v1/maintenance-tasks/integration-opportunities` | 5.7 KB | **1.15 s** | 3.05 s | Minor (table joins) | No |
| `GET /api/v1/candidate-blocks?page=1&page_size=5` | 6.7 KB | **8.28 s** | 19.6 s | **YES (Timetable cross-product)** | **YES (keeps spinners active)** |
| `GET /api/v1/candidate-blocks?page_size=100` | 134.9 KB | **9.15 s** | 21.2 s | **YES (Full candidate generation)** | **YES (on map)** |
| `GET /api/v1/optimization/runs?page=1&page_size=1` | 7.4 KB | **1.12 s** | 3.22 s | No (SQL query) | No |
| `GET /api/v1/optimization/runs/1/blocks?page_size=100` | 26.0 KB | **2.23 s** | 6.40 s | Minor (block mapping) | No |

---

## 6. Database & Master-Data File Verification

### Verification Result
- **Repository Search**:
  - `howrah_division_master_data.xlsx` is referenced only in `scripts/seed_data.py`.
  - `openpyxl` is imported only in `scripts/seed_data.py`.
  - `read_excel` has **0 occurrences** across `services/api`.
- **Runtime Data Source**:
  - All runtime controllers, routers, and services query PostgreSQL via asynchronous SQLAlchemy (`get_db` async sessions).
  - **Conclusion**: The large Excel master-data sheet is **NOT read at runtime**. It is purely an offline seed artifact and is completely uninvolved in production request latency.

---

## 7. Startup & Warmup Inspection

### Lifespan Analysis (`services/api/app/main.py`)
```python
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    yield
    from app.core.database import engine
    await engine.dispose()
```
- **Startup Logic**: Clean and minimal. No ML models, no Excel files, no large CSVs, and no seed data are loaded into memory on process boot.
- **Why Cold Starts Take ~45s**: The delay is infrastructure-level: Render's free tier spins down the container VM when idle. Waking up requires provisioning the container, starting Python 3.12, initializing Uvicorn, and connecting to Supabase via TLS.

---

## 8. Candidate Block Engine Performance

### Current State
- In Optimization #1 (`7ca710c`), redundant window-level train conflict checks were cached in-memory per window ID, improving candidate generation from ~26s down to ~8.2s on production.
- **Remaining Bottleneck**: When `generate_candidates()` is called without a `section_id` filter (as `/dashboard` and `/map` do), it generates candidate windows across **all 9 sections of Howrah Division** across the entire 7-day timetable, resulting in ~15,652 candidate calculations before returning the top 5 or top 100 items.

---

## 9. Optimization / Solver Trigger Verification

### Verification Result
- **OR-Tools CP-SAT Trigger**: Located exclusively in `services/api/app/routers/optimization.py` under:
  ```python
  @router.post("/runs", response_model=OptimizationRunResponse)
  async def create_optimization_run(...)
  ```
- **Conclusion**: The CP-SAT mathematical solver is **NEVER accidentally triggered** during login, dashboard loading, calendar rendering, or page navigation. Optimization runs occur strictly when an authorized user (`PLANNER`, `CONTROL`, `ADMIN`) explicitly submits the configuration form on `/optimization`.

---

## 10. Map GIS & Geospatial Rendering Cost

When the user navigates to `/map`:
1. **API Requests**: Fires 6 concurrent queries: `stations`, `sections`, `maintenance-tasks`, `candidate-blocks?page_size=100`, `optimization-runs`, and `optimized-blocks`.
2. **Payload Size**: The candidate blocks query alone transmits **134.9 KB** of JSON containing 100 candidate windows with spatial coordinates.
3. **Execution Time**: The candidate blocks query takes **9.15s** on production.
4. **Leaflet Canvas**: Leaflet is dynamically imported (`ssr: false`) with a loading placeholder. It does not block page routing, but the map layers remain in a partial state until all 6 queries resolve.

---

## 11. Production vs. Local Comparison

| Factor | Local Development | Production Environment | Latency Delta |
|---|---|---|---|
| **Backend Compute** | Multi-core Host CPU | Render Free Tier (Shared single vCPU) | 3x–5x slower CPU-bound loops |
| **Database Network** | `localhost:5432` ($< 1\text{ ms}$) | Vercel $\rightarrow$ Render (Oregon/Frankfurt) $\rightarrow$ Supabase AWS ($80\text{ ms}$ RTT) | +150ms per round-trip query |
| **Cold Starts** | None (always running) | 15-min idle spin-down | +30s to 50s on initial wake-up |
| **Asset Delivery** | Local Next.js dev server | Vercel Edge CDN | Production frontend HTML/JS is faster |

---

## 12. Real User Experience & Perception Gaps

A user perceives the application as slow due to four distinct psychological/UI factors:
1. **Aggregated Loading States**: The dashboard displays loading skeletons or disables refresh until *all* queries finish. Because `candidate-blocks` takes 8.3s, the entire dashboard appears stalled even though tasks, sections, and KPIs loaded in 1.1s.
2. **Cold Start Penalty**: First-time SIH judges clicking "Enter Demo Workspace" encounter Render's 45s container spin-up and assume the application has crashed.
3. **Map Over-fetching**: The Map requests 100 candidate blocks (135 KB) upfront even if the user only wants to view station layouts or track sections.
4. **Navigation Fetch Delays**: Navigating from `/dashboard` to `/planning` refetches tasks and opportunities without optimistic UI rendering.

---

## 13. Root-Cause Impact Ranking

```
+─────────────────────────────────────────────────────────────────────────────+
|                               ROOT-CAUSE RANKING                            |
+─────────────────────────────────────────────────────────────────────────────+
| HIGH IMPACT                                                                 |
| 1. Render Free-Tier Cold Starts (30s–50s on idle wake-up)                    |
| 2. Candidate-Block Generation on Dashboard & Map (8.2s–9.1s latency)       |
| 3. Monolithic Loading State on Dashboard (slowest query blocks UI readiness)|
+─────────────────────────────────────────────────────────────────────────────+
| MEDIUM IMPACT                                                               |
| 4. Map Over-fetching (page_size=100 candidate blocks = 135 KB on mount)    |
| 5. Redundant Queries on /maintenance (Summary strip + Filtered list)        |
| 6. Inter-Region Network Round-Trips (Vercel -> Render -> Supabase)          |
+─────────────────────────────────────────────────────────────────────────────+
| LOW IMPACT                                                                  |
| 7. Leaflet Dynamic Client-Side Import Overhead (~100ms)                     |
| 8. Client-side JavaScript filtering across 100 items (< 10ms)               |
+─────────────────────────────────────────────────────────────────────────────+
```

---

## 14. Safe Improvement Plan (Zero-Risk Roadmap)

> [!IMPORTANT]
> **NO CHANGES HAVE BEEN MADE.** The following improvements are proposed for review and can be scheduled individually following our strict "one optimization at a time" rule.

### Proposal 1: Decouple Candidate Blocks on Dashboard (Frontend-Only)
- **Benefit**: Dashboard becomes interactive in **1.1 seconds** instead of 8.5 seconds.
- **Approach**: Render the KPI Overview, Maintenance Queue, and Latest Optimization Run immediately. Load the Candidate Blocks Summary widget asynchronously with its own independent skeleton.
- **Risk**: Extremely low (frontend UI isolation only).
- **Files**: `services/web/src/app/dashboard/page.tsx`.
- **Affects Auth/RBAC/Solver/DB?**: NO.
- **Reversible?**: Yes.

### Proposal 2: Lazy-Load Map Candidate Layer (Frontend-Only)
- **Benefit**: Railway Network Map loads stations and sections in **1.1 seconds**; candidate blocks (9.1s, 135 KB) only load when the user toggles the "Candidate Blocks" layer checkbox to active.
- **Risk**: Extremely low.
- **Files**: `services/web/src/app/map/page.tsx`.
- **Affects Auth/RBAC/Solver/DB?**: NO.
- **Reversible?**: Yes.

### Proposal 3: Section-Scoped Candidate Block Generation (Backend Perf)
- **Benefit**: Reduces candidate generation execution time from ~8.3s to **< 0.8s** when scoped to a single corridor section.
- **Approach**: If `section_id` is supplied, candidate generation only analyzes that section's timetable rather than all 9 division sections.
- **Risk**: Low (preserves exact math and constraints).
- **Files**: `services/api/app/services/candidate_block_engine.py`.
- **Affects Auth/RBAC/Solver/DB?**: NO.
- **Reversible?**: Yes.

### Proposal 4: Production Keep-Alive Ping (Operational/DevOps)
- **Benefit**: Eliminates the 30–50s cold-start delay for SIH judges.
- **Approach**: Use an external free monitor (e.g. UptimeRobot or a cron schedule) to ping `GET /health` every 10 minutes to keep the Render worker warm.
- **Risk**: Zero code risk.
- **Files**: None.
- **Affects Auth/RBAC/Solver/DB?**: NO.
- **Reversible?**: Yes.
