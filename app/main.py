from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.middleware.sessions import SessionMiddleware
from starlette.requests import Request
from dotenv import load_dotenv
import os
import sys
from pathlib import Path

load_dotenv()
app = FastAPI()
repo_root = Path(__file__).resolve().parents[1]

# session cookie for login state
app.add_middleware(
    SessionMiddleware,
    secret_key=os.getenv("SESSION_SECRET", "dev"),
    same_site="lax",
    https_only=False,   # set True when you use HTTPS in prod
)

templates = Jinja2Templates(directory="app/templates")


def resolve_command_center_base() -> str:
    default_base = "/dashboard" if os.getenv("RENDER") else "http://localhost:3001"
    candidates = [
        "COMMAND_CENTER_URL",
        "DASHBOARD_VITE_URL",
        "DASHBOARD_URL",
        "NEXT_PUBLIC_COMMAND_CENTER_URL",
        "NEXT_PUBLIC_DASHBOARD_VITE_URL",
        "NEXT_PUBLIC_DASHBOARD_URL",
    ]
    for key in candidates:
        raw = os.getenv(key)
        if not raw:
            continue
        trimmed = raw.rstrip("/")
        if "/command-center/" in trimmed:
            continue
        return trimmed
    return default_base


COMMAND_CENTER_BASE = resolve_command_center_base()
templates.env.globals["command_center_base"] = COMMAND_CENTER_BASE

app.mount("/static", StaticFiles(directory="app/static"), name="static")

dashboard_dist = repo_root / "frontend" / "apps" / "dashboard-vite" / "dist"
if dashboard_dist.exists():
    app.mount(
        "/dashboard",
        StaticFiles(directory=str(dashboard_dist), html=True),
        name="dashboard-vite",
    )

@app.get("/")
def home(request: Request):
    return templates.TemplateResponse("home.html", {"request": request})

@app.get("/home")
def home(request: Request):
    return templates.TemplateResponse("home.html", {"request": request})

@app.get("/about")
def about(request: Request):
    return templates.TemplateResponse("info_about.html", {"request": request})

# init database tables
from app.db import init_db
init_db()

from app import auth
app.include_router(auth.router)

from app import catalog
app.include_router(catalog.router)

from app import cart
app.include_router(cart.router)

from app import checkout
app.include_router(checkout.router)


# Optional: mount legacy Command Center (automation_prototype) if present
try:
    cc_root = repo_root / "automation_prototype"
    if cc_root.exists():
        if str(cc_root) not in sys.path:
            sys.path.insert(0, str(cc_root))
        from backend.app import app as command_center_app  # type: ignore

        app.mount("/command-center", command_center_app)
except Exception:
    # If legacy command center is unavailable, continue without mounting it.
    pass
