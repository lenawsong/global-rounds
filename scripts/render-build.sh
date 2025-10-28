#!/usr/bin/env bash

set -euo pipefail


corepack enable

pushd frontend >/dev/null

pnpm install --no-frozen-lockfile

pnpm --filter dashboard-vite build

popd >/dev/null

python -m pip install -r requirements.txt

python -m pip install -r automation_prototype/backend/requirements.txt
