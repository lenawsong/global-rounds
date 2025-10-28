# Global Rounds – Local Runbook

This guide lists every command needed to spin up the project locally. Each section calls out the exact directory you should be in before running the command.

---

## Quick Start (AntV Dashboard)

**Directory:** `project root`

```bash
./scripts/start-antv-dashboard.sh --force-install   # short form: -f
```

This one-liner bootstraps the frontend workspace (runs `pnpm install` if needed) and launches the AntV/Vite dashboard. Use `--force-install` / `-f` on the first run or whenever dependencies drift; drop the flag for faster subsequent launches. Make sure the FastAPI backend from step 4 is running beforehand if you want live data.

---

## 1. Clone & Python Virtual Environment

**Directory:** `project root` (`/Users/stoptime/global-rounds`)

```bash
python3 -m venv .venv
source .venv/bin/activate           # Windows: .venv\Scripts\activate
python -m pip install --upgrade pip
```

---

## 2. Install Python Dependencies

**Directory:** `project root`

```bash
python -m pip install -r requirements.txt
python -m pip install -r automation_prototype/backend/requirements.txt
```

---

## 3. Seed Sample Data (optional but recommended)

**Directory:** `project root`

```bash
python seed.py
```

---

## 4. Start the FastAPI Backend

**Directory:** `project root`

```bash
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

> The Command Center automation API (used by the dashboard) still listens on port `8001`. If you need it, start the automation backend instead:

```bash
uvicorn automation_prototype.backend.app:app --reload --port 8001
```

---

## 5. Frontend Workspace Setup

**Directory:** `frontend/`

```bash
pnpm install
```

This installs dependencies for every app/package in the Turborepo workspace and wires up shared binaries (e.g., `vite`). Run it once before starting any frontend apps; rerun if you see missing binary errors.

> Dependency tip: If the install complains that `@antv/s2-react` cannot be found, pull the latest repo (we pin it to `2.2.x`) and rerun the install.

---

## 6. Run the Dashboard (Vite + Ant Design + AntV) — Recommended

**Directory:** `frontend/`

```bash
pnpm --filter dashboard-vite dev
```

This launches the new AntV implementation of the Nexus Health operator dashboard (G2Plot charts, S2 tables, G6 graph views). Make sure the FastAPI automation backend from step 4 is running so the visualizations can hydrate with live data.

> Troubleshooting: If `vite: command not found` appears, rerun `pnpm install` from `frontend/` to restore workspace binaries, then re-run the dev command.

> One-liner: From the repo root you can run `./scripts/start-antv-dashboard.sh` — it installs dependencies if needed and then launches the Vite dev server.

Once the shell loads, use the **Navigation Map** menu item to explore a clickable node graph of every page and jump straight into each section.

Create a `.env.local` in `frontend/apps/dashboard-vite/` (or export `VITE_API_BASE`) so the app can reach the automation backend:

```
VITE_API_BASE=http://localhost:8001
```

The Vite dev server runs on http://localhost:3001 by default.

Need a deeper walkthrough of the AntV stack? See `docs/VITE_MIGRATION_GUIDE.md` and the adapters in `frontend/packages/charts-antv/src/`.

---

## 7. Run the Legacy Dashboard (Next.js, optional)

**Directory:** `frontend/apps/dashboard`

```bash
pnpm dev -p 3001
```

Set `.env.local` with `NEXT_PUBLIC_API_BASE` if you still need to run the Next.js build.

---

## 8. Run the SvelteKit Visual Rebuild (experimental)

**Directory:** `frontend/apps/dashboard-svelte`

```bash
pnpm --filter dashboard-svelte dev
```

Set `PUBLIC_API_BASE` for live data (or rely on built‑in fallbacks):

```
PUBLIC_API_BASE=http://localhost:8001
```

Routes included: `/` (Overview), `/ops`, `/lexicon` (others are placeholders). Charts use ECharts; Lexicon uses a Cytoscape stub with safe lazy loading.

---

## 9. Run the Marketing Site (optional)

**Directory:** `frontend/apps/web`

```bash
pnpm dev -p 3000
```

Set the optional `.env.local` values (`NEXT_PUBLIC_DASHBOARD_URL`, etc.) to link back to the dashboard or legacy flows.

---

## 10. Frontend Quality Checks (Vite dashboard)

**Directory:** `frontend/`

Build & type-check:

```bash
pnpm --filter dashboard-vite build
```

Playwright smoke (ensure `pnpm --filter dashboard-vite dev` is running first):

```bash
pnpm --filter dashboard-vite test:e2e
```

---

## 11. Render Build (Dashboard assets + FastAPI)

**Directory:** `project root`

Render runs this composite build so the Vite dashboard assets exist before FastAPI starts. Run it locally to mirror the hosted pipeline or when you need to regenerate the static bundle served at `/dashboard`:

```bash
./scripts/render-build.sh  # runs pnpm install --no-frozen-lockfile before building
```

The script enables Corepack, installs workspace dependencies, builds the Vite dashboard, and reinstalls the Python requirements. The generated assets land in `frontend/apps/dashboard-vite/dist/`, which FastAPI mounts at `/dashboard` during deploys.

---

## 12. Frontend Quality Checks (Legacy dashboard)

**Directory:** `frontend/`

Lint (add an ESLint config first if you have not already):

```bash
pnpm --filter dashboard lint
```

Type check/build:

```bash
pnpm --filter dashboard build
```

Playwright smoke tests (ensure the dashboard dev server is running on port 3001):

```bash
pnpm --filter dashboard test:e2e
```

---

## 13. Stop Services

Hit `Ctrl+C` in the terminal window running each dev server (`uvicorn`, `pnpm dev`, etc.). Deactivate the Python venv when finished:

**Directory:** any

```bash
deactivate
```

---

## Quick Reference Table

| Component                    | Directory                     | Command                                                      |
| --------------------------- | ------------------------------ | ------------------------------------------------------------ |
| Python venv setup           | project root                   | `python3 -m venv .venv && source .venv/bin/activate`         |
| Install Python deps         | project root                   | `python -m pip install -r requirements.txt`                  |
| Automation backend deps     | project root                   | `python -m pip install -r automation_prototype/backend/requirements.txt` |
| Seed sample data            | project root                   | `python seed.py`                                             |
| Main FastAPI app            | project root                   | `python -m uvicorn app.main:app --reload`                    |
| Automation backend (8001)   | project root                   | `uvicorn automation_prototype.backend.app:app --reload --port 8001` |
| Install frontend packages   | `frontend/`                    | `pnpm install`                                               |
| Dashboard dev server (Vite) | `frontend/apps/dashboard-vite` | `pnpm --filter dashboard-vite dev`                           |
| Dashboard build (Vite)      | `frontend/`                    | `pnpm --filter dashboard-vite build`                         |
| Dashboard Playwright (Vite) | `frontend/`                    | `pnpm --filter dashboard-vite test:e2e`                      |
| Legacy dashboard dev        | `frontend/apps/dashboard`      | `pnpm dev -p 3001`                                           |
| Marketing dev server        | `frontend/apps/web`            | `pnpm dev -p 3000`                                           |
| Legacy dashboard lint       | `frontend/`                    | `pnpm --filter dashboard lint`                               |
| Legacy dashboard build      | `frontend/`                    | `pnpm --filter dashboard build`                              |
| Legacy Playwright tests     | `frontend/`                    | `pnpm --filter dashboard test:e2e`                           |

Keep this document handy when onboarding new teammates or switching machines. Update it whenever commands change so the entire stack can be launched without guesswork.
