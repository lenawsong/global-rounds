# Nexus Health – Project Context (for ChatGPT Pro)

This document equips ChatGPT Pro with everything needed to reason about, modify, and extend the current Nexus Health build.

## High‑Level Overview
- Purpose: Nexus Health orchestrates end‑to‑end DME operations (intake → documentation → fulfillment → revenue cycle) with automation agents, patient/partner links, and a modern operator dashboard.
- Architecture: FastAPI backend (automation rail + endpoints) + Next.js monorepo frontend (apps for marketing + dashboard), shared UI/charts/API packages.
- Data model: Synthetic CSV/JSON under `automation_prototype/data` feed agent logic and demo visualizations.

## Tech Stack
- Backend: Python 3, FastAPI, Uvicorn, Pydantic, httpx
- Frontend: Next.js (App Router) + TypeScript, Tailwind CSS, TanStack Query, Vega‑Lite via `react‑vega`
- Build/Tooling: PNPM workspaces (Turborepo), Storybook (UI QA), Playwright (E2E smoke)

## Repository Layout
```
automation_prototype/
  backend/            # FastAPI app + automation endpoints
  automation/         # Agent logic (ordering, payments, workforce, etc.)
  data/               # Synthetic datasets (CSV/JSON)
frontend/
  apps/
    web/              # Marketing shell (Nexus Health landing)
    dashboard/        # Operator cockpit (Ops, Finance, Inventory, Engagement, Scenarios, Ask, Agents, Lexicon)
  packages/
    ui/               # Design primitives (Card, Badge, Metric, Layout, etc.)
    charts/           # Vega‑Lite specs + React wrapper
    api/              # Typed SDK for FastAPI
  pnpm-workspace.yaml # Workspace config
  turbo.json          # Turborepo pipeline
```

## Backend – Key Files & Responsibilities
- `automation_prototype/backend/app.py`
  - Mounts static assets, exposes all automation endpoints, orchestrates agents.
  - Notable endpoints:
    - `POST /api/agents/run`, `GET /api/agents/status`
    - `GET /api/last-run` (rail snapshot)
    - `POST /api/dashboard/ask` (LLM chat)
    - `POST /api/inventory/scenario` (what‑if)
    - `POST /api/compliance/report` (PDF export)
    - Patient links: `POST/GET /api/patient-links`, `POST /api/patient-actions`
    - Partner orders: `POST/GET /api/partners/*`
- `automation_prototype/backend/schemas.py`
  - Pydantic models for requests/responses (agents, tasks, chat, inventory scenarios, partner orders, lexicon, etc.).
- `automation_prototype/backend/portal.py`
  - Portal order store + assessment (compliance status, quantities, fulfillment suggestions).
- `automation_prototype/backend/tasks.py`
  - Task store, SLA references, breach handling; utility to ensure tasks for holds.
- `automation_prototype/backend/llm.py`
  - Guarded LLM client used by “Ask the Dashboard.”
- `automation_prototype/backend/reporting.py`
  - Compliance alert PDF generation.
- `automation_prototype/automation/*`
  - Agent logic (ordering, payments, workforce, engagement, performance, finance).
- Data: `automation_prototype/data/*` (CSV + JSON; `dashboard_sample.json` for demo)

## Frontend – Monorepo Structure
- Apps
  - `apps/web`: marketing shell (Nexus branding, links to dashboard/intake/legacy)
  - `apps/dashboard`: main operator UI (tabs + modules + legacy ports)
- Packages
  - `packages/ui`: shared UI components (Card, Badge, Metric, Layout, Tabs, Skeleton)
  - `packages/charts`: Vega‑Lite chart specs (donut, bars with labels, line with points) + React wrapper
  - `packages/api`: typed client for backend endpoints (agents, status, snapshot, orders, scenario, LLM chat, compliance PDF)

## Dashboard – Features & Routes (ported from legacy)
- Overview `/`
  - Nexus Health Command Center header
  - Metrics (active tasks, AI approvals, automation coverage)
  - Queue/Compliance donuts (Vega‑Lite)
- Ops `/ops`
  - Queue mix; compliance triage; Task Inbox (top workload)
  - “Export Compliance PDF” (POST `/api/compliance/report`)
- Finance `/finance`
  - Variance distribution (underpayments buckets), Denial Pareto, Documentation queue table
- Inventory `/inventory`
  - Patient work orders, vendor recommendations, forecast bars
  - Scenario planner (POST `/api/inventory/scenario`) with table + chart for deltas
- Engagement `/engagement`
  - Channel mix (SMS/email/voice) and escalation feed
- Scenarios `/scenarios`
  - Dedicated scenario inputs + results (growth, lead time, focus SKUs)
- Ask the Dashboard `/ask`
  - LLM chat (POST `/api/dashboard/ask`), chat log + input
- Agents Center `/agents`
  - Run all/single agents (POST `/api/agents/run`), status table (GET `/api/agents/status`)
- KPI Lexicon `/lexicon`
  - Recursive expansion UI (POST `/api/lexicon/expand`), local sample fallback

## Frontend – Key Files
- Shell & routing
  - `apps/dashboard/src/app/layout.tsx` (Nexus nav: Overview, Ops, Finance, Inventory, Engagement, Scenarios, Ask, Agents, Lexicon)
  - `apps/dashboard/src/app/providers.tsx` (TanStack Query provider)
- Modules
  - `components/OverviewClient.tsx`, `ops/`, `finance/`, `inventory/`, `engagement/`, `scenarios/`
  - `components/AskClient.tsx`, `components/AgentsClient.tsx`, `components/LexiconClient.tsx`
- Shared
  - `packages/api/src/index.ts` (full typed SDK)
  - `packages/charts/src/specs.ts` (polished Vega‑Lite specs)
  - `packages/ui/src/components/*` (Button, Card, Badge, Metric, Layout, Tabs, Skeleton)

## Configuration & Env
- Backend URL for the dashboard
  - `apps/dashboard/.env.local`:
    - `NEXT_PUBLIC_API_BASE=http://localhost:8001`
- Marketing links (optional)
  - `apps/web/.env.local`:
    - `NEXT_PUBLIC_DASHBOARD_URL=http://localhost:3001`
    - `NEXT_PUBLIC_LEGACY_DASHBOARD_URL=http://localhost:8001/command-center/dashboard/`
    - `NEXT_PUBLIC_INTAKE_URL=http://localhost:8001/command-center/patient/intake.html`

## Runbook
1) Backend (FastAPI)
   - Create venv & install: `pip install -r requirements.txt && pip install -r automation_prototype/backend/requirements.txt`
   - Start: `uvicorn automation_prototype.backend.app:app --reload --port 8001`
2) Frontend (monorepo)
   - `cd frontend && pnpm install`
   - Dashboard: `cd apps/dashboard && pnpm dev -p 3001` (or `PORT=3001 pnpm --filter dashboard dev`)
   - Web: `cd apps/web && pnpm dev -p 3000` (or `PORT=3000 pnpm --filter web dev`)

## Visualization Notes
- Charts: Vega‑Lite via `react‑vega`, centralized specs in `packages/charts/src/specs.ts` with brand palette, readable axes, tooltips, and labels.
- If API is offline: charts may be empty except Lexicon (which has local sample). Add global snapshot fallbacks if needed.

## Common Issues & Fixes
- `ModuleNotFoundError: httpx` when starting Uvicorn
  - Install: `pip install -r automation_prototype/backend/requirements.txt`
- Next dev “Invalid project directory: --”
  - Run from app folder with `pnpm dev -p 3001` or use `PORT=3001 pnpm --filter dashboard dev`.
- Blank charts
  - Ensure API is on `http://localhost:8001` and `NEXT_PUBLIC_API_BASE` matches.

## Design & Theming
- Brand: Nexus Health palette applied to charts/cards; consistent spacing & typographic scale.
- Dark mode is deferred; focus on clarity and legibility in light mode.

## Next Steps (optional)
- Add universal sample snapshot fallbacks so charts never render empty.
- Deepen partner/payer integrations in the UI (eligibility, prior auth flows).
- Storybook: build out component docs for all UI primitives.
- Playwright: expand beyond smoke to cover key module flows.

---

This context should let ChatGPT Pro accurately navigate code, locate responsibilities, understand the runtime configuration, and make high‑quality changes across backend and frontend modules.

