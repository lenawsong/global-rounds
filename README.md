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
python -m pip install "fastapi" "uvicorn[standard]" "sqlmodel" \
    "jinja2" "passlib[bcrypt]" "itsdangerous" "python-dotenv" \
    "python-multipart" "stripe"
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
pip install -r requirements.txt && \
pip install -r automation_prototype/backend/requirements.txt
```

Start Command
```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Notes
- The Command Center is mounted at `/command-center/` and appears in the header nav.
- Set env vars as needed: `SESSION_SECRET` (generate), `DATABASE_URL` (defaults to SQLite), `ANTHROPIC_API_KEY` (for Command Center features), and optional Stripe keys.
