# Nexus Health Dashboard (Vite + Ant Design + AntV)

This package hosts the rebuilt Nexus Health operator dashboard using Vite, React 18, TypeScript, Ant Design 5, and the AntV visualization suite.

## Prerequisites

- Node.js 18+
- PNPM 9+

## Setup

```bash
pnpm install
```

## Environment

Create `.env.local` (or export) with the API base URL:

```
VITE_API_BASE=http://localhost:8001
```

## Development

```bash
pnpm --filter dashboard-vite dev
```

The app runs on [http://localhost:3001](http://localhost:3001) by default.

## Build

```bash
pnpm --filter dashboard-vite build
```

## Tests

Run Playwright smoke tests (ensure the dev server is running):

```bash
pnpm --filter dashboard-vite test:e2e
```

## Features

- Ant Design ProLayout shell with global filter bar and dark-mode toggle
- AntV G2Plot charts (donut, bar, Pareto, histogram, radial progress, tornado)
- AntV S2 tables for data-heavy modules
- Zustand stores for global filters, Ask chat history, and theme mode
- TanStack Query data fetching with API fallbacks and optimistic UI hooks
- Modules: Overview, Ops, Finance, Inventory, Engagement, Scenarios, Ask, Agents, Lexicon (with G6 relationship graph)

Refer to `docs/LOCAL_RUNBOOK.md` for backend setup instructions.
