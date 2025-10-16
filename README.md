# Global Rounds – Local Development

## Prerequisites
- Python 3.9 or newer.
- Recommended: `uvicorn` extra dependencies installed via pip (see below).

## Setup & Installation
```bash
# from the project root
python3 -m venv .venv
source .venv/bin/activate           # Windows: .venv\Scripts\activate

# pin installs to the venv’s interpreter
python -m pip install --upgrade pip

# storefront deps
python -m pip install -r requirements.txt

# (optional) command center deps for /command-center
python -m pip install -r automation_prototype/backend/requirements.txt
```

## Seed the Database (optional, but useful for sample data)
```bash
python seed.py
```

## Run the Development Server
```bash
python -m uvicorn app.main:app --reload
```

The site will be available at http://127.0.0.1:8000/.

## Environment Variables (optional)
- `SESSION_SECRET`: overrides the default session key.
- `DATABASE_URL`: use a different database backend than the default SQLite `app.db`.
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `BASE_URL`: required only if you plan to exercise Stripe checkout flows locally.

> **Note for zsh users:** wrap extras in quotes (e.g. `"uvicorn[standard]"`, `"passlib[bcrypt]"`) so the shell does not treat the brackets as glob patterns.

> **Missing dependency errors:** install any reported package in the active venv. Example: `python -m pip install itsdangerous` for session support, `python -m pip install jinja2` for template rendering.

## Render Deployment
- Repo: `lenawsong/global-rounds` (this project)
- Service: Web Service (Python)

Build Command
```bash
python -m pip install -r requirements.txt && \
python -m pip install -r automation_prototype/backend/requirements.txt
```

Start Command
```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Notes
- The Command Center is mounted at `/command-center/` and appears in the header nav.
- Set env vars as needed: `SESSION_SECRET` (generate), `DATABASE_URL` (defaults to SQLite), `ANTHROPIC_API_KEY` (for Command Center features), and optional Stripe keys.

### Render setup steps (recommended)
- Root directory: `.` (so `render.yaml` is picked up).
- Python: 3.11.x. If the UI shows 3.13 by default, switch to 3.11 or let `render.yaml` control it (pythonVersion 3.11.9).
- Do not override Build/Start in the UI unless necessary; if you do, use the commands above exactly.
- Clear Build Cache on the service when switching repos/branches to ensure the latest commit and commands are used.

### Migrating an existing Render service
1) In the service settings, change the GitHub repository to `lenawsong/global-rounds` and the branch to `main`.
2) Clear Build Cache, then Deploy latest.
3) Verify the app at the root URL and that `/command-center/` loads.

### Troubleshooting
- `pip: command not found` during Build: remove stray backslashes and use `python -m pip` as shown above.
- Building an old commit: Clear Build Cache and deploy again; confirm the commit SHA matches GitHub.
- Python 3.13 selected: set Python 3.11 in the UI or rely on `render.yaml` by not overriding language/runtime settings.
- Repo access warning: reauthorize the Render GitHub App for this repo or make the repo public to Render.
- Command Center features inactive: set `ANTHROPIC_API_KEY` in the service environment.
