# Nexus Health — Investor Pitch Script

_Tagline: Orchestrating DME operations end‑to‑end with automation agents and a single Command Center._

> Use this script verbatim or trim for a 7–10 minute delivery. Replace bracketed fields before export to PDF.

---

## Opening (30s)
- I’m [Your Name], founder of Nexus Health. We automate durable medical equipment operations end‑to‑end—intake, documentation, fulfillment, and revenue cycle—through a single Command Center and an automation rail.
- In DME, margin is crushed by manual compliance, fragmented systems, and denials. Our software orchestrates the whole flow and turns teams into exception managers.

## Problem (60–90s)
- Fragmented workflow: intake, documentation, inventory, partners, and payers live in different systems; operators re‑enter data across screens.
- Compliance risk: small misses (F2F dates, WOPD, prior auth) create holds and payer denials.
- Cash friction: remits return with variance; reconciliation and appeals are slow and manual.
- Workforce pressure: backlogs spike unpredictably (seasonality, payer changes, vendor lead times) while staffing stays flat.

## Solution (60s)
- Nexus Health is a Command Center plus an automation rail:
  - Agents for ordering, payments, workforce, engagement, performance, and finance.
  - Patient and partner links to close loops, and payer connectors for eligibility, prior auth, and remits.
  - "Ask the Dashboard" — an LLM assistant grounded in live context for ops, finance, and inventory decisions.
- We don’t rip‑and‑replace the core system of record; we orchestrate across it and deliver action, guardrails, and outcomes.

## Product Walkthrough (3–4 min)
- Overview: Unified status tiles and donuts — “Active tasks, AI approvals, automation coverage.”
- Ops: Queue mix, compliance triage, Task Inbox with SLA context. One click exports a Compliance PDF packet.
- Finance: Denial Pareto and variance distributions; underpayments surface with tasks to pursue.
- Inventory: Forecasting + vendor reorder recommendations, and a Scenario Planner (growth %, lead time, target SKUs).
- Engagement: Patient messages by channel plus escalations to case managers.
- Agents Center: Run all/single agents; see last‑run status across ordering, payments, workforce, engagement, performance, finance.
- Ask the Dashboard: Natural‑language questions resolved from current snapshot and recent events.
- Lexicon: Shared KPI definitions and graph view for consistent language across teams.

### Demo Plan (fast and visual)
1. Ops → “Export Compliance PDF” to show instant artifact creation.
2. Inventory → run a scenario (+10% growth, +2 days lead time) to show deltas.
3. Agents → Run all agents; flip back to Overview to see updates.
4. Ask → “Which claims need documentation?” to show grounded answers and next steps.

> Repo mapping: Frontend `frontend/apps/dashboard-vite` (AntV charts, S2 tables, G6 graphs). Backend `automation_prototype/backend` (FastAPI on :8001) with endpoints for agents, tasks, scenarios, payers, compliance PDF, intake, and chat.

## Why Now (45s)
- Payer/partner APIs are standardizing; LLM guardrails make narrative + ops safe and useful.
- Denial pressure and staffing constraints make automation ROI immediate.
- DME providers want systems that pay for themselves within a quarter.

## Traction & Modeled ROI (60s)
- From demo/marketing configuration (replace with live pilot numbers as available):
  - AI approvals: 92% of orders auto‑cleared without manual review.
  - Time to fulfill: < 24 hours median (last 30 days).
  - Denial lift: −38% after launch.
  - Modeled annualized savings: $412k from automation + payment recovery.
- API includes a revenue‑impact model (ordering time saved, payment recovery, workforce efficiency) to tie value to contracts.

## Business Model (45s)
- SaaS subscription aligned to value (six‑figure deployments with multiple modules).
- Add‑ons for high‑volume messaging and payer/partner connectors.
- Land with Ops + Finance; expand to Inventory, Engagement, and Provider Co‑Pilot for multi‑year ACV growth.

## Go‑To‑Market (45s)
- Start with mid‑market DME providers and regional suppliers; sell to operations and revenue leaders with a 2–4 week pilot.
- Channels: vendor networks (dropship), payer tech programs, consulting/outsourcing partners.
- Expansion path: home health and specialty clinics sharing the same “intake → docs → fulfillment → cash” pipeline.

## Competition & Differentiation (60s)
- Legacy DME/EHR/billing tools are systems of record. Nexus is an orchestration layer that:
  - Unifies the full pipeline and closes loops (links, agents, scenarios).
  - Ships with deterministic guardrails (SLA policies, compliance scans, auditable events).
  - Turns context into action (PDF packets, partner orders, payer remits, patient messages).
  - Offers a narrative interface (Ask the Dashboard) grounded in your data.

## Moat (30s)
- Compounding playbooks: payer responses, partner SLAs, and task outcomes feed our guardrails.
- Workflow exhaust (PDFs, event logs, timelines) creates switching costs over time.

## Roadmap (45s)
- Provider Co‑Pilot: templated WOPD/F2F capture + e‑sign with task completion.
- Deeper payer/prior auth integrations and eligibility snapshots.
- Scenario libraries by device tier and seasonality; automated staffing recommendations by queue mix.
- SOC 2 and HIPAA program maturity with BAA workflow; harden audit vault and retention policies.

## The Ask (30–45s)
- We’re raising [$X pre‑seed/seed] to hit [N pilots in 6 months, SOC 2 Type I, payer connectors, sales hires].
- Use of funds: engineering (automation + integrations), compliance, and go‑to‑market.

## Close (15s)
- Nexus Health turns DME operations into a measurable, automated machine. We’d love to partner with you to scale it.

---

## Live Demo Checklist
- Backend: `uvicorn automation_prototype.backend.app:app --reload --port 8001`
- Frontend: from `frontend/` → `pnpm install` then `pnpm --filter dashboard-vite dev`
- Env: `frontend/apps/dashboard-vite/.env.local` with `VITE_API_BASE=http://localhost:8001`
- Quick links: Overview `/`, Ops `/ops`, Inventory `/inventory`, Ask `/ask`, Agents `/agents` (default `http://localhost:3001`)

## FAQ Cheat Sheet
- Integration: Interoperate via APIs/flat files; start read‑only, progress to write‑back (patient links, partner orders, payer remits).
- Data privacy: Run in your VPC; minimal PHI in transit; plan for BAA, SOC 2, and HIPAA‑compliant processes as we enter production.
- What replaces what? We orchestrate across the EHR/billing core; we do not replace it.
- Proof of value: 2–4 week pilot with modeled revenue impact and concrete artifacts (PDFs, tasks closed, remits processed).
- Pricing: Annual subscription aligned to modules + volume; six‑figure deployments when multiple modules are active.

> Tip for PDF export: add your logo/cover page, keep 14–16 pt headings with generous whitespace, and place Demo + Traction early. Consider one slide per section; keep bullets to 1–2 lines each.

