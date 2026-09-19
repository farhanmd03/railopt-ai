\# RAILOPT AI — PROJECT CONTEXT MASTER



\## 1. Project

RailOpt AI — AI-assisted railway maintenance block planning and

optimization prototype for SIH26027.



\## 2. Current architecture



Frontend:

\- Next.js

\- TypeScript

\- Tailwind CSS

\- shadcn/ui

\- TanStack Query



Backend:

\- FastAPI

\- SQLAlchemy

\- PostgreSQL/PostGIS

\- Keycloak OIDC/RBAC



Optimization:

\- Priority Engine

\- Compatibility Engine

\- Candidate Block Engine

\- OR-Tools CP-SAT



Local AI:

\- XGBoost for ML risk/impact prediction

\- Ollama for explanation only



\## 3. Existing completed capabilities



\- Excel → PostgreSQL ingestion

\- dataset validation and relational QA

\- railway sections/stations/assets/tasks

\- maintenance priority calculation

\- cross-department compatibility

\- candidate maintenance blocks

\- train conflict detection

\- corridor/window checks

\- freight/resource checks

\- OR-Tools optimization

\- optimization persistence

\- optimization REST API

\- Next.js application shell

\- Keycloak authentication

\- RBAC



\## 4. Current scope



Howrah Division prototype.



The system is a decision-support prototype.

It is NOT an official railway safety or possession authorization system.



\## 5. Core intelligence model



AI/ML:

\- predicts maintenance risk/impact



Deterministic decision layer:

\- priority and compatibility logic



Optimization:

\- OR-Tools CP-SAT chooses feasible scheduling combinations



Generative AI:

\- Ollama explains already-computed system decisions



Human:

\- negotiates, reviews, approves/rejects



\## 6. National-round required additions



1\. Inter-department communication/negotiation

2\. Explicit AI role boundaries

3\. AI-assisted approval recommendation + mandatory human decision

4\. Audit/decision history

5\. In-app notifications

6\. Counterfactual/postpone engine

7\. Possession Readiness Gate

8\. Possession Outcome Ledger

9\. Negotiation drawer

10\. Data Adapter source badges

11\. Weekly/monthly planning

12\. What-if scenarios

13\. polished UI/UX

14\. deployable public demo



\## 7. Required safety/product principles



\- AI never directly grants track possession.

\- AI never autonomously approves execution.

\- OR-Tools does not replace human approval.

\- Solver status != business approval.

\- Frontend RBAC is UX only.

\- Backend RBAC is authoritative.

\- No fake live integrations.

\- No fabricated railway facts.

\- Prototype/synthetic ML results must be explicitly labelled.

\- No paid dependency is mandatory.



\## 8. Source badges



TRD → TDMS

Engineering → TMS

S\&T → SMMS

Timetable/window constraints → COA



These are prototype source-adapter labels unless a real live integration exists.



\## 9. Product workflow



Data

→ ML risk/impact

→ priority

→ compatibility

→ candidate blocks

→ CP-SAT optimization

→ optimized plan

→ negotiation / counterfactuals

→ readiness gate

→ human approval

→ audit

→ notification



\## 10. Implementation rule



Build in small batches.



After every implementation:

1\. run tests

2\. inspect actual changes

3\. Claude independently reviews

4\. MUST FIX → generate one Antigravity fix prompt

5\. APPROVED → commit



Never perform a large uncontrolled rewrite.



\## 11. Deployment



Local development remains the reference environment.



Public deployment is a showcase environment only.



Never make production/public deployment the place where features are

first developed.



\## 12. Current Git checkpoint



Frontend authentication/foundation is already committed.



Do not rewrite previous approved batches unless a concrete regression is

found.

