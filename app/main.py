from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.middleware.sessions import SessionMiddleware
from starlette.requests import Request
from dotenv import load_dotenv
import os

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
