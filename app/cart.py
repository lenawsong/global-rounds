from typing import Optional
from fastapi import APIRouter, Depends, Request, Form
from fastapi.responses import RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlmodel import select
from app.db import get_session
from app.models import Cart, CartItem, Product
from app.auth import current_user

router = APIRouter()
templates = Jinja2Templates(directory="app/templates")

def ensure_cart(user_id: int, session):
    cart = session.exec(select(Cart).where(Cart.user_id == user_id)).first()
    if not cart:
        cart = Cart(user_id=user_id)
        session.add(cart); session.commit(); session.refresh(cart)
    return cart

@router.post("/cart/add")
def add_to_cart(request: Request, product_id: int = Form(...), quantity: int = Form(1), session=Depends(get_session)):
    user = current_user(request, session)
    if not user: return RedirectResponse("/login", status_code=303)
    p = session.get(Product, product_id)
    if not p or not p.active: return RedirectResponse("/catalog", status_code=303)
    cart = ensure_cart(user.id, session)
    item = session.exec(select(CartItem).where(CartItem.cart_id == cart.id, CartItem.product_id == p.id)).first()
    if item: item.quantity += max(1, quantity)
    else: session.add(CartItem(cart_id=cart.id, product_id=p.id, quantity=max(1, quantity)))
    session.commit()
    return RedirectResponse("/cart", status_code=303)

@router.get("/cart")
def view_cart(request: Request, session=Depends(get_session)):
    user = current_user(request, session)
    if not user: return RedirectResponse("/login", status_code=303)
    cart = session.exec(select(Cart).where(Cart.user_id == user.id)).first()
    items = []; total = 0
    if cart:
        items = session.exec(
            select(CartItem, Product)
            .where(CartItem.cart_id == cart.id)
            .join(Product, CartItem.product_id == Product.id)
        ).all()
        for (ci, p) in items:
            total += p.price_cents * ci.quantity
    return templates.TemplateResponse("cart.html", {"request": request, "items": items, "total_cents": total})

@router.post("/cart/remove")
def remove_item(request: Request, item_id: int = Form(...), session=Depends(get_session)):
    user = current_user(request, session)
    if not user: return RedirectResponse("/login", status_code=303)
    ci = session.get(CartItem, item_id)
    if ci: session.delete(ci); session.commit()
    return RedirectResponse("/cart", status_code=303)
