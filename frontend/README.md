# Global Rounds Frontend (Next.js Monorepo)

This is a production‑grade frontend scaffold to rebuild the dashboard and marketing site with a world‑class UI/UX. It is organized as a PNPM workspace (Turborepo style) with apps and shared packages.

## Tech Stack
- Next.js (App Router) + TypeScript
- Tailwind CSS + Radix UI primitives (compatible with shadcn/ui)
- TanStack Query for data fetching/caching
- Vega‑Lite (via `react-vega`) for charts; AntV G2Plot optional as secondary
- Storybook for component QA (optional)
- Playwright for E2E smoke tests (optional)

## Workspace Layout
```
frontend/
  apps/
    web/           # public marketing + authenticated shell
    dashboard/     # operator cockpit (Ops, Finance, Inventory, Engmt, Scenarios)
  packages/
    ui/            # shared UI components (cards, buttons, tabs)
    charts/        # composable Vega‑Lite chart wrappers
    api/           # typed SDK for the FastAPI backend
  package.json
  pnpm-workspace.yaml
  turbo.json
  tsconfig.base.json
```

## Quickstart
1) Install PNPM if needed: `npm i -g pnpm`
2) From `frontend/`, install deps:
   ```bash
   pnpm install
   ```
3) Start the marketing shell:
   ```bash
   pnpm --filter web dev
   # optional port override
   pnpm --filter web dev -- -p 3100
   ```
   Visit http://localhost:3000 (or the port you choose).

4) Start the dashboard shell in a second terminal:
   ```bash
   pnpm --filter dashboard dev
   # optional port override
   pnpm --filter dashboard dev -- -p 3101
   ```
   Visit http://localhost:3001 (or your port).

5) Storybook (component QA):
   ```bash
   pnpm storybook
   ```
   - Available at http://localhost:6006

6) Playwright smoke test (after `pnpm --filter dashboard dev` in another terminal):
   ```bash
   pnpm --filter dashboard test:e2e
   ```

## Environment
The dashboard expects the automation API (FastAPI) at `http://localhost:8001` by default. Override via `NEXT_PUBLIC_API_BASE`.

Create `apps/dashboard/.env.local`:
```
NEXT_PUBLIC_API_BASE=http://localhost:8001
```

The marketing shell links to the dashboard and intake experience. Override defaults as needed:

```
NEXT_PUBLIC_DASHBOARD_URL=http://localhost:3001
NEXT_PUBLIC_LEGACY_DASHBOARD_URL=http://localhost:8001/command-center/dashboard/
NEXT_PUBLIC_INTAKE_URL=http://localhost:8001/command-center/patient/intake.html
```

## Migration Path
1) Shell & design system: use `packages/ui` and Tailwind tokens to lock the light theme, spacing, and typography.
2) Charts: port the current cards to `packages/charts` Vega‑Lite specs and swap in real datasets via `packages/api`.
3) Pages: build `apps/web` landing/auth; `apps/dashboard` tabs for Ops, Finance, Inventory, Engagement, Scenarios.
4) Replace the existing static dashboard when parity is met.

## Scripts
- `pnpm dev` – run all apps
- `pnpm build` – build all workspaces
- `pnpm lint` – lint sources
- `pnpm test:e2e` – run Playwright tests (after installing browsers)

## Notes
- Storybook/Playwright configs are minimal placeholders; enable as you go.
- This scaffold avoids runtime network calls during bootstrap here; install locally.
