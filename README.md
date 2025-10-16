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
