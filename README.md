# RailOpt AI 🚆

> **AI-Powered Multi-Department Railway Maintenance Block Planning & Combinatorial Corridor Optimization**  
> *Smart India Hackathon (SIH) Grand Finale & Ministry of Railways Enterprise Production Platform*

---

## 1. Executive Summary & Problem Statement

### The Problem
Indian Railways operates one of the densest rail networks in the world, running over 13,000 passenger and 8,000 freight trains daily across 68,000+ route kilometers. Maintenance of civil track (**Engineering / Permanent Way**), signaling & interlocking (**S&T**), and overhead electrification (**TRD / Electrical**) currently relies on fragmented, departmental manual requisitions.

This departmental fragmentation causes:
- **Corridor Thrashing**: The same track section is closed multiple times on different days for separate departmental tasks, multiplying passenger train disruptions.
- **Under-utilized Traffic Blocks**: Approved blocks frequently expire without cross-departmental coordination.
- **Safety & Asset Degradation**: Urgent track fractures and signaling faults suffer delays due to scheduling conflicts.
- **Lack of Mathematical Rigor**: Human planners cannot manually evaluate thousands of combinatorial corridor windows against multi-criteria operational trade-offs.

### The Solution: RailOpt AI
**RailOpt AI** is an intelligent, multi-department corridor optimization platform built specifically for Indian Railways divisional operations (benchmarked on the **Howrah Division, Eastern Railway**). It consolidates work orders across Engineering, S&T, and TRD into synchronized corridor possessions using Google OR-Tools CP-SAT integer programming, grounded local AI explainability, and multi-department sign-off workflows.

---

## 2. Core Platform Capabilities

| Capability | Technical Mechanism | Operational Value |
|---|---|---|
| **Dynamic Priority Engine** | Multi-factor risk scoring ($W_{\text{sev}} + W_{\text{risk}} + W_{\text{overdue}} + W_{\text{crit}}$) | Automatically elevates critical track defects and overdue safety work orders. |
| **Corridor Compatibility Engine** | Section-station spatial graph mapping | Identifies co-located cross-departmental tasks that can be safely consolidated into a single possession. |
| **Candidate Window Generator** | Timetable occupancy and corridor headway analysis | Generates 15,000+ discrete candidate possession windows without passenger train collisions. |
| **Combinatorial Solver** | Google OR-Tools CP-SAT Constraint Programming Solver | Computes globally optimal 7-day/30-day block schedules in $< 3.0$ seconds. |
| **Interactive Railway Map** | OpenStreetMap + Leaflet + Spatial PostGIS | Visualizes assets, live track corridor geometry, and scheduled possession zones. |
| **Planning Calendar & Timeline** | Interactive Gantt & multi-day scheduling grid | Provides station superintendents and controllers with hour-by-hour operational clearance. |
| **What-If Scenario Analysis** | Non-destructive combinatorial parameter simulation | Allows planners to test alternative weights (e.g. strict passenger priority vs. urgent maintenance focus). |
| **Local AI Explainability** | Grounded Ollama LLM (`gemma2:2b`) | Delivers natural language operational reasoning with zero cloud token cost and zero hallucination risk. |
| **Enterprise Security & RBAC** | Keycloak OIDC + JWT + 8 Granular Railway Roles | Enforces deny-by-default access control across Section Controllers, Approvers, and Engineers. |
| **Human Sign-Off & Audit Trail** | Immutable PostgreSQL state machine | Full governance: `DRAFT` $\rightarrow$ `SUBMITTED` $\rightarrow$ `APPROVED` / `REJECTED` with actor logging. |

---

## 3. Mathematical Optimization Formulation

RailOpt AI models railway maintenance planning as a **Constraint Satisfaction and Mixed-Integer Programming (MIP)** problem solved by **Google OR-Tools CP-SAT**.

### 3.1 Objective Function
The optimizer maximizes overall maintenance value while penalizing train disruption, freight impact, and corridor fragmentation:

$$\max Z = \sum_{b \in \mathcal{B}} \left( W_{\text{pri}} \cdot P(b) + W_{\text{int}} \cdot B_{\text{int}}(b) + W_{\text{sch}} \cdot N_{\text{tasks}}(b) \right) - \sum_{b \in \mathcal{B}} \left( W_{\text{disr}} \cdot D_{\text{train}}(b) + W_{\text{frt}} \cdot D_{\text{freight}}(b) + W_{\text{unused}} \cdot U(b) + W_{\text{blocks}} \cdot 1 \right)$$

Where:
- $P(b)$: Realized priority score of tasks assigned to block $b$.
- $B_{\text{int}}(b)$: Multi-department integration bonus awarded when tasks from $\ge 2$ departments share block $b$.
- $N_{\text{tasks}}(b)$: Total number of distinct work orders completed.
- $D_{\text{train}}(b)$: Passenger timetable disruption penalty.
- $D_{\text{freight}}(b)$: Freight throughput penalty.
- $U(b)$: Unused idle window time within the corridor block.

### 3.2 Hard Operational Invariants (Protected Constraints)
1. **Single Task Assignment**: Each work order $i$ is scheduled in at most one block: $\sum_{b} x_{i,b} \le 1$.
2. **Section Exclusivity**: No two overlapping blocks may occupy the same track corridor section simultaneously: $\forall b_1, b_2 \in \mathcal{B}, \text{Overlaps}(b_1, b_2) \implies y_{b_1} + y_{b_2} \le 1$.
3. **Horizon Invariant**: All block start and end timestamps must strictly lie within the planning horizon: $T_{\text{start}} \le \text{Start}(b) < \text{End}(b) \le T_{\text{end}}$.
4. **Feasibility Guarantee**: Block duration must strictly satisfy the maximum required maintenance duration among assigned tasks: $\text{Duration}(b) \ge \max_{i \in b} d_i$.

---

## 4. System Architecture

```
                                  +---------------------------------------+
                                  |         Next.js 16 (React 19)         |
                                  |    Tailwind CSS + Lucide + Leaflet   |
                                  +-------------------+-------------------+
                                                      |
                                          HTTP / REST | Authorization Bearer JWT
                                                      v
+------------------------+        +-------------------+-------------------+        +------------------------+
|     Keycloak 26.4      |<------>|         FastAPI Backend API          |<------>|     Ollama Local AI    |
|   (OIDC Identity /     |        |      (Python 3.12 / Pydantic v2)      |        |      (`gemma2:2b`)     |
|   8 Divisional Roles)  |        +-------------------+-------------------+        |  Zero-Cost Explanation |
+------------------------+                            |                            +------------------------+
                                                      |
                         +----------------------------+----------------------------+
                         |                                                         |
                         v                                                         v
          +------------------------------+                          +------------------------------+
          |    Google OR-Tools CP-SAT    |                          |     PostgreSQL 17 / PostGIS   |
          |  Integer Programming Engine  |                          |   (Corridors, Assets, Tasks, |
          |   (< 3s Optimization Solve)  |                          |    Audit Logs, Timestamps)   |
          +------------------------------+                          +------------------------------+
```

---

## 5. Technology Stack

- **Frontend**: Next.js 16 (App Router, Turbopack), React 19, Tailwind CSS, TanStack Query v5, Lucide Icons, Leaflet / React-Leaflet, `oidc-client-ts` / `react-oidc-context`.
- **Backend API**: FastAPI 0.141, Python 3.12, Pydantic v2, SQLAlchemy 2.0 (Async), `asyncpg` / `psycopg3`, Alembic migrations.
- **Optimization Solver**: Google OR-Tools 9.15 (CP-SAT Constraint Programming Solver).
- **Database & GIS**: PostgreSQL 17 + PostGIS 3.5 spatial extensions.
- **Identity & Security**: Keycloak 26.4 (OpenID Connect, OAuth 2.0, RS256 JWT validation).
- **Explainability AI**: Ollama Local Runtime with Google Gemma 2 (`gemma2:2b`).

---

## 6. Howrah Division (Eastern Railway) Master Dataset

RailOpt AI is loaded with authentic, verified master data from **Howrah Division (ER)**:
- **9 Core Track Sections**: `HOW_SEC_001` (Howrah - Barddhaman Main Line), `HOW_SEC_002` (Howrah - Barddhaman Chord), `HOW_SEC_003` (Bandel - Katwa), etc.
- **37 Key Stations**: Howrah Junction (`HWH`), Barddhaman (`BWN`), Bandel (`BDC`), Dankuni (`DKAE`), Seoraphuli (`SHE`), Katwa (`KWAE`), Rampurhat (`RPH`), etc.
- **101 Track, Signal, & OHE Assets**: Real Asset IDs, Criticality Indices ($0.0 - 1.0$), Failure Risk Scores ($0.0 - 1.0$).
- **53 Active Maintenance Work Orders**: Real defect types (Rail Fracture, Point Machine Stagnation, OHE Contact Wire Wear, Track Geometry Defect) across Engineering, S&T, and TRD.

---

## 7. Role-Based Access Control (RBAC) Matrix

The platform enforces strict, deny-by-default role boundaries across 8 railway user profiles:

| Account | Credentials | Role | Permissions |
|---|---|---|---|
| `admin.demo` | `Environment Controlled` | **ADMIN** | Full administrative and operational control across all modules. |
| `planner.demo` | `Environment Controlled` | **PLANNER** | Full access to generate CP-SAT plans, run What-If scenarios, and submit for sign-off. |
| `control.demo` | `Environment Controlled` | **CONTROL** | Section controller access with corridor clearance and solver trigger permissions. |
| `approver.demo` | `Environment Controlled` | **APPROVER** | DRM / Sr. DOM authority: Review optimization runs, approve, or reject with audit notes. |
| `engineering.demo`| `Environment Controlled` | **ENGINEERING** | Civil / Track department: View work orders, assets, and schedule possessions. |
| `snt.demo` | `Environment Controlled` | **SNT** | Signaling & Telecom: View signal defects, interlockings, and integration opps. |
| `trd.demo` | `Environment Controlled` | **TRD** | Traction Distribution: View overhead equipment wear, power blocks, and schedule. |
| `viewer.demo` | `Environment Controlled` | **VIEWER** | Read-only access to published corridor possessions and operational dashboards. |

---

## 8. Local Quickstart Guide

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (v24+)
- Python 3.11+ / Node.js 20+
- [Ollama](https://ollama.ai/) (optional for local AI explainability: `ollama pull gemma2:2b`)

### Step 1: Clone Repository
```bash
git clone https://github.com/farhanmd03/railopt-ai.git
cd railopt-ai
```

### Step 2: Launch Docker Services (Database & Keycloak)
```bash
docker compose up -d
```
*Wait 15 seconds for PostgreSQL (Port 5432) and Keycloak (Port 8080) to become healthy.*

### Step 3: Run Database Migrations & Seed Howrah Data
```bash
cd services/api
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On Linux/macOS:
source .venv/bin/activate

pip install -r requirements.txt
python -m alembic upgrade head
python ../../scripts/seed_data.py
python ../../scripts/setup_keycloak.py
```

### Step 4: Start Backend API
```bash
python run_server.py
```
*FastAPI server running at http://127.0.0.1:8000 (Swagger docs at http://127.0.0.1:8000/docs).*

### Step 5: Start Frontend Application
```bash
cd ../web
npm install
npm run dev
```
*Next.js application running at http://localhost:3000.*

---

## 9. Automated Testing & Production Build

### Run Complete Backend Test Suite (14 Suites)
```bash
cd services/api
pytest tests/ -v
```
*Result: 14/14 test suites passing (100%).*

### Run Complete Frontend Test Suite (21 Suites, 133 Tests)
```bash
cd services/web
npm test -- --run
```
*Result: 21/21 test files, 133/133 tests passing (100%).*

### Run Production Build Verification
```bash
cd services/web
npm run build
```
*Result: 16/16 routes compiled with zero TypeScript or ESLint errors.*

### Run End-to-End Production Smoke Test
```bash
python scripts/run_production_smoke_test.py
```
*Result: Complete live execution (Health $\rightarrow$ Auth $\rightarrow$ Solver $\rightarrow$ Results $\rightarrow$ What-If $\rightarrow$ Approval $\rightarrow$ Explainability) verified in $< 15$ seconds.*

---

## 10. Smart India Hackathon (SIH) Demo Access & Evaluation Walkthrough

### 8 Dedicated Demo Operational Roles
RailOpt AI includes 8 pre-configured Keycloak roles for evaluators and teammates:

| Role | Demo Identity | Operational Scope & Authority |
|---|---|---|
| **ADMIN** | `admin.demo` | Full administrative control, system settings, and override capabilities. |
| **PLANNER** | `planner.demo` | Work order consolidation, candidate generation, and OR-Tools CP-SAT plan solving. |
| **CONTROL** | `control.demo` | Operational corridor monitoring and live train conflict management. |
| **APPROVER** | `approver.demo` | Divisional Railway Manager (DRM) review, approval authorization, and rejection with audit reasons. |
| **ENGINEERING** | `engineering.demo` | Civil track maintenance workbench, track settlement repairs, and rail fracture requisitions. |
| **S&T** | `snt.demo` | Signal & Telecom operations, point machine maintenance, and interlocking inspections. |
| **TRD** | `trd.demo` | Traction Distribution / Overhead Electrification (OHE) power block management. |
| **VIEWER** | `viewer.demo` | Read-only operational visibility across all corridors, maps, and calendar views. |

### Demo Access Configuration
- **Toggle**: Controlled via `DEMO_ACCESS_ENABLED` (backend) / `NEXT_PUBLIC_DEMO_ACCESS_ENABLED` (frontend).
- **Security Invariant**: Credentials are server/environment-controlled (`DEMO_USER_PASSWORD` in `.env`). No credentials or passwords are hardcoded in the frontend codebase or bundle.
- **Evaluation Notice**: *Demo accounts are intended for evaluation, SIH judging, and project review only.* Production deployments should keep demo access disabled (`DEMO_ACCESS_ENABLED=false`).

### 2-Minute SIH Live Demo Sequence

1. **Sign In as Planner**:
   - Open `http://localhost:3000/login` $\rightarrow$ Under **DEMO ACCESS**, select **Planner** (`planner.demo`) $\rightarrow$ Click **Enter Demo Workspace**.
2. **Command Dashboard**:
   - Review 6 KPI cards. Click **Critical & High** $\rightarrow$ Deep-links directly to `/maintenance?severity=Critical`.
3. **Maintenance Workbench**:
   - Inspect Task `WO-0007` (Emergency Rail Fracture at Howrah Yard). Open Detail Drawer to inspect dynamic priority score breakdown ($99.0$).
4. **Planning Workspace**:
   - Navigate to `/planning`. Review 39 Cross-Department Integration Opportunities and 15,000+ candidate possession windows.
5. **Generate CP-SAT Optimization Plan**:
   - Navigate to `/optimization`. Click **Generate Plan**.
   - Watch Google OR-Tools CP-SAT solve the full Howrah Division corridor schedule in $\approx 2.5$ seconds (`OPTIMAL` status, 45/53 tasks scheduled into 19 possession blocks).
6. **Results & Gantt Timeline**:
   - Inspect scheduled block distribution (15 integrated multi-department blocks, 4 single-task blocks).
   - Click **View on Map** $\rightarrow$ Renders highlighted track corridors on OpenStreetMap.
   - Click **Planning Calendar** $\rightarrow$ Renders weekly dispatch schedule.
7. **AI Explainability Router**:
   - Click **Explain Results with AI** $\rightarrow$ Explainability Router evaluates active providers:
     - **Local Preferred**: Local Ollama (`gemma2:2b`) for zero-cost, air-gapped operation.
     - **Hosted Fallback**: Google Gemini (`gemini-2.5-flash`) for cloud deployments.
     - **Zero-Network Fallback**: Deterministic rule engine for 100% offline reliability.
8. **What-If Scenario Simulation**:
   - Click **What-If Scenario** $\rightarrow$ Test strict Passenger Priority ($W_{\text{train}} = 5.0\times$). Observe mathematical delta trade-offs without modifying the base run.
9. **Submit for Human Approval**:
   - Click **Submit for Approval** $\rightarrow$ Plan transitions to `SUBMITTED`.
10. **Approver Sign-off & Audit Trail**:
    - Sign out (with confirmation dialog) and select **Approver** (`approver.demo`).
    - Open the plan $\rightarrow$ Click **Approve Plan**.
    - Verify immutable audit record created with timestamp and DRM actor attribution.

---

## 11. Production Cloud Deployment Architecture

RailOpt AI is designed for containerized deployment across major cloud providers (AWS, Azure, GCP, or Ministry of Railways National Data Centers):

- **Full-Stack Docker Compose**: `docker-compose.prod.yml` encapsulates `postgres` (PostGIS), `keycloak`, `api` (FastAPI), `web` (Next.js standalone), and `ollama`.
- **Stateless Horizontal Scaling**: FastAPI and Next.js are completely stateless; all operational state resides in PostgreSQL.
- **LLM Explainability Boundary**: RailOpt AI keeps LLM execution strictly behind the FastAPI explainability boundary. Ollama is preferred for local operation; Gemini can be used as a hosted fallback via backend configuration. Neither provider has authority over scheduling, approval, or safety decisions.

---

## 12. Hosting & Cloud Candidate Feasibility

For evaluation and cloud hosting scenarios:
- **Frontend**: Vercel candidate (`services/web`), configured with `NEXT_PUBLIC_API_URL` pointing to the public backend domain.
- **Backend**: Render candidate (`services/api`), executing FastAPI with Python 3.12+ and Google OR-Tools CP-SAT.
- **Database**: Supabase / Managed PostgreSQL with PostGIS extension for spatial topology.
- **Keycloak OIDC**: Requires a public HTTPS endpoint (or reverse proxy) with matching issuer and redirect URIs in the `railopt` realm.
- **LLM Explainability**: Set `GEMINI_API_KEY` in backend environment variables for hosted cloud environments; system automatically uses Gemini when Ollama is offline.

---

## 12. License & Author Attribution

Developed for the **Smart India Hackathon (SIH)** by Team RailOpt AI.  
Dataset Benchmark: Eastern Railway (Howrah Division), Ministry of Railways, Government of India.
