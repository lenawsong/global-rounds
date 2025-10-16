# Global Rounds Automation Prototype

This repository simulates the "Not-Two" rail for Global Rounds: one event stream, one task queue, and machine-attested outcomes for every order. The code runs entirely on synthetic data but models how the production system will orchestrate fulfillment, compliance, financial hygiene, and partner experiences around a shared event ledger.

## Core Capabilities
- **Rail SLA Engine** – Declarative SLA specs compiled to code (`backend/sla.py`). CLI/API evaluation emits `sla.updated` events, calculates credits, assigns breach tasks, and tracks volume tiers.
- **Unified Task Queue v1.1** – Persistent task store with SLA references, breach reasons, first-pass flags, and cycle times. API consumers can list, acknowledge, and close tasks; closing breaches re-runs the SLA engine.
- **Event Ledger** – Append-only JSONL log with replay, topic filters, and server-sent events/webhooks. Every order change (`order.created/approved/...`) is recoverable.
- **Provider Co-Pilot** – Role-aware portal feed, WOPD/F2F templates, e-sign stubs, and task completion actions that clear holds and update dispositions.
- **Patient Deep-Link Microsite** – Time-boxed links for confirm/reschedule/help flows that post actions, open tasks, and publish events.
- **Compliance Radar v1.1** – Always-on scan for 719A/F2F/prior-auth expirations; auto-creates tasks, emits radar events, and surfaces KPI counts.
- **Predictive Inventory + Scenario API** – Exponential smoothing forecaster with growth/lead-time levers that feeds ordering agents and exposes scenario endpoints.
- **Financial Pulse** – Weekly ROI snapshot for labor minutes saved, projected cash recovery, and DSO deltas; reconciles with the revenue model CLI.
- **Payer Connectors** – Deterministic adapters for eligibility, prior-auth status, and remit ingestion that emit `payer.updated` and close reconciliation tasks.
- **External DME API** – Partner endpoints for compliant order intake, webhooks, RBAC keys, and pay-per-order usage reporting.
- **Audit Vault** – Immutable timeline + attachments (checksummed) per order with one-click export to satisfy ACHC/JCAHO and payer audits.
- **LLM Guardrails** – Deterministic drafts for appeals/status notes validated by schemas; falls back to templates when validation fails.

## Repository Layout
```
automation_prototype/
  automation/              # Ordering, payments, workforce, engagement, performance, finance, inventory agents
  backend/                 # FastAPI app, SLA engine, tasks, events, providers, patient links, compliance, payers, webhooks, audit vault
  portal/                  # Provider & patient microsites
  dashboard/               # Operator dashboard consuming the API feed
  data/                    # Synthetic fixtures (orders, events, tasks, payer data, etc.)
  cli.py                   # CLI entry point for all agents + utilities
  tests/                   # Unit coverage for SLA + task behaviors
```

## CLI Runbook
```bash
# Seed infrastructure + verify feature flags
python cli.py infrastructure

# Run all agents (ordering, payments, workforce, engagement, performance, finance)
python cli.py run-all --as-of 2024-09-01

# Evaluate SLA for one order (replays the event ledger)
python cli.py sla-evaluate --order-id ORD-1001

# Rebuild the timeline from the ledger
python cli.py events-replay --order-id ORD-1001 --from 2024-08-01

# Compliance Radar + Revenue Model (weekly ops cadence)
python cli.py compliance-scan --as-of 2024-09-01
python cli.py revenue-model --as-of 2024-09-01
```

Pass `--output path.json` to persist run artifacts or `--data-dir alt-fixtures/` to swap data feeds.

## API Highlights
The FastAPI app in `backend/app.py` exposes the automation rail:
- `POST /api/sla/evaluate`, `GET /api/sla/policy`
- `GET /api/tasks`, `POST /api/tasks/{id}/acknowledge`, `POST /api/tasks/{id}/status`
- `GET /api/events/stream` (SSE) and `POST /api/webhooks`
- Provider Co-Pilot routes (`/api/provider/co-pilot`, `/forms/wopd`, `/esign`, `/tasks/{id}/complete`)
- Patient microsite routes (`/api/patient_links`, `/api/patient_actions`)
- Compliance radar (`/api/compliance/scan`), predictive inventory (`/api/inventory/*`), finance snapshot (`/api/finance/snapshot`), payer connectors, and external DME partner APIs.

Run `uvicorn backend.app:app --reload` to explore interactively.

## Data & Simulation
All datasets in `data/` are synthetic. Swap them with Brightree/Kyron/payer exports once credentials are approved. The event ledger (`data/events.jsonl`) captures every simulated transition so dashboards, SSE listeners, and partners agree on the same truth source.

## Testing
```
pytest
```
Tests focus on SLA evaluation, task enrichment, and breach handling. Add scenario-specific fixtures to extend coverage for partner integrations or additional SLAs.

## Next Steps
1. Replace CSV fixtures with secure ETL jobs (Brightree, Kyron, payer SFTP/EDI).
2. Persist the ledger/task queue in Postgres or Dynamo for multi-node workers.
3. Harden predictive models (Prophet/LightGBM) when production history accrues.
4. Wire SMS/email/push providers for patient/clinician notifications post-HIPAA review.
5. Promote the dashboard into your production BI stack (Metabase/Looker) with live feeds.

## Quickstart Script
Run `./start_local.sh` from the repository root to create/activate the virtual environment, install dependencies (skip with `SKIP_PIP=1`), seed synthetic data (skip with `SKIP_INFRA=1`), and start the FastAPI server on the chosen port (default 8001; override with `PORT`). Set `AS_OF` for a different simulation date or `RELOAD=0` to disable auto-reload.

- Place sensitive settings (e.g. `ANTHROPIC_API_KEY`, `DASHBOARD_LLM_MODEL=claude-sonnet-4-5`) in an `.env` file alongside the script or export them in the same shell before launching. The script automatically loads `.env` if present and prints whether the Anthropic key was detected.
- To override the model inline without editing `.env`, run `DASHBOARD_LLM_MODEL=claude-sonnet-4-5 SKIP_PIP=1 SKIP_INFRA=1 ./start_local.sh`.
