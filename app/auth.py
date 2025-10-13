from fastapi import APIRouter, Depends, Request, Form
from fastapi.responses import RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlmodel import select
from passlib.context import CryptContext
from app.db import get_session
from app.models import User
from typing import Optional

router = APIRouter()
templates = Jinja2Templates(directory="app/templates")
pwd = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

@router.get("/signup")
def signup_page(request: Request):
    return templates.TemplateResponse("auth_signup.html", {"request": request})

@router.post("/signup")
def signup(request: Request, email: str = Form(...), password: str = Form(...), session=Depends(get_session)):
    existing = session.exec(select(User).where(User.email == email)).first()
    if existing:
        return templates.TemplateResponse("auth_signup.html", {"request": request, "error": "Email already registered"})
    user = User(email=email, hashed_password=pwd.hash(password))
    session.add(user); session.commit(); session.refresh(user)
    request.session["user_id"] = user.id
    return RedirectResponse("/", status_code=303)

@router.get("/login")
def login_page(request: Request):
    return templates.TemplateResponse("auth_login.html", {"request": request})

@router.post("/login")
def login(request: Request, email: str = Form(...), password: str = Form(...), session=Depends(get_session)):
    user = session.exec(select(User).where(User.email == email)).first()
    if not user or not pwd.verify(password, user.hashed_password):
        return templates.TemplateResponse("auth_login.html", {"request": request, "error": "Invalid credentials"})
    request.session["user_id"] = user.id
    return RedirectResponse("/", status_code=303)

@router.get("/logout")
def logout(request: Request):
    request.session.pop("user_id", None)
    return RedirectResponse("/", status_code=303)

# after (works on Python 3.9)
def current_user(request: Request, session=Depends(get_session)) -> Optional[User]:
    uid = request.session.get("user_id")
    return session.get(User, uid) if uid else None
