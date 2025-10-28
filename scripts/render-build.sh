#!/usr/bin/env bash

set -euo pipefail

corepack enable

pnpm install

pnpm --filter dashboard-vite build

python -m pip install -r requirements.txt

python -m pip install -r automation_prototype/backend/requirements.txt
