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

# session cookie for login state
app.add_middleware(
    SessionMiddleware,
    secret_key=os.getenv("SESSION_SECRET", "dev"),
    same_site="lax",
    https_only=False,   # set True when you use HTTPS in prod
)

templates = Jinja2Templates(directory="app/templates")
app.mount("/static", StaticFiles(directory="app/static"), name="static")

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


# Optional: mount Command Center (automation_prototype) if present
try:
    repo_root = Path(__file__).resolve().parents[1]
    cc_root = repo_root / "automation_prototype"
    if cc_root.exists():
        if str(cc_root) not in sys.path:
            sys.path.insert(0, str(cc_root))
        from backend.app import app as command_center_app  # type: ignore
        app.mount("/command-center", command_center_app)
        # If the sub-app redirects '/' -> '/dashboard/' as an absolute path,
        # catch '/dashboard/' at the top level and send users back to the mounted path.
        from fastapi.responses import RedirectResponse  # inline import to avoid unused if CC absent

        @app.get("/dashboard/", include_in_schema=False)
        def redirect_global_dashboard():
            return RedirectResponse(url="/command-center/dashboard/")
except Exception:
    # If command center is not available, keep main app running
    pass
