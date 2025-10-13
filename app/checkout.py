from fastapi import APIRouter, Depends, Request
from fastapi.responses import RedirectResponse, PlainTextResponse
from fastapi.templating import Jinja2Templates
from sqlmodel import select
from app.db import get_session
from app.models import Cart, CartItem, Product, Order, OrderItem
from app.auth import current_user
import stripe, os

router = APIRouter()
templates = Jinja2Templates(directory="app/templates")
stripe.api_key = os.getenv("STRIPE_SECRET_KEY","")
BASE_URL = os.getenv("BASE_URL","http://localhost:8000")
WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET","")

@router.get("/checkout")
def checkout(request: Request, session=Depends(get_session)):
    user = current_user(request, session)
    if not user: return RedirectResponse("/login", status_code=303)
    return RedirectResponse("/create-checkout-session", status_code=303)

@router.get("/create-checkout-session")
def create_checkout_session(request: Request, session=Depends(get_session)):
    user = current_user(request, session)
    if not user: return RedirectResponse("/login", status_code=303)

    cart = session.exec(select(Cart).where(Cart.user_id == user.id)).first()
    if not cart: return RedirectResponse("/cart", status_code=303)
    items = session.exec(
        select(CartItem, Product)
        .where(CartItem.cart_id == cart.id)
        .join(Product, CartItem.product_id == Product.id)
    ).all()
    if not items: return RedirectResponse("/cart", status_code=303)

    total = sum(p.price_cents * ci.quantity for (ci, p) in items)
    order = Order(user_id=user.id, status="pending", total_cents=total)
    session.add(order); session.commit(); session.refresh(order)

    line_items = [{
        "quantity": ci.quantity,
        "price_data": {
            "currency": "usd",
            "unit_amount": p.price_cents,
            "product_data": {"name": p.name}
        }
    } for (ci, p) in items]

    cs = stripe.checkout.Session.create(
        mode="payment",
        line_items=line_items,
        success_url=f"{BASE_URL}/orders/{order.id}?success=1",
        cancel_url=f"{BASE_URL}/cart?canceled=1",
        metadata={"order_id": str(order.id)}  # never put medical/PHI here
    )
    order.stripe_session_id = cs["id"]; session.add(order); session.commit()

    # persist order items (pending)
    for (ci, p) in items:
        session.add(OrderItem(order_id=order.id, product_id=p.id, quantity=ci.quantity, unit_price_cents=p.price_cents))
    session.commit()

    return RedirectResponse(cs.url, status_code=303)

@router.post("/webhooks/stripe")
async def stripe_webhook(request: Request, session=Depends(get_session)):
    payload = await request.body()
    sig = request.headers.get("stripe-signature")
    try:
        event = stripe.Webhook.construct_event(payload=payload, sig_header=sig, secret=WEBHOOK_SECRET)
    except Exception as e:
        return PlainTextResponse(str(e), status_code=400)

    if event["type"] == "checkout.session.completed":
        cs = event["data"]["object"]
        order_id = (cs.get("metadata") or {}).get("order_id")
        if order_id:
            order = session.get(Order, int(order_id))
            if order and order.status != "paid":
                order.status = "paid"
                session.add(order); session.commit()
                # (optional) clear cart after paid

    return PlainTextResponse("ok")

from fastapi import Depends
@router.get("/orders/{order_id}")
def order_success(order_id: int, request: Request, session=Depends(get_session)):
    order = session.get(Order, order_id)
    return templates.TemplateResponse("order_success.html", {"request": request, "order": order})

