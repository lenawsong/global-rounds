# from fastapi import APIRouter, Depends, Request
# from fastapi.templating import Jinja2Templates
# from sqlmodel import select
# from app.db import get_session
# from app.models import Product
# from typing import Optional

# router = APIRouter()
# templates = Jinja2Templates(directory="app/templates")

# @router.get("/catalog")
# # after (3.9-friendly)
# def list_products(request: Request, q: Optional[str] = None, session=Depends(get_session)):
#     stmt = select(Product).where(Product.active == True)
#     if q:
#         like = f"%{q}%"
#         stmt = stmt.where((Product.name.ilike(like)) | (Product.description.ilike(like)) | (Product.sku.ilike(like)))
#     products = session.exec(stmt.order_by(Product.name)).all()
#     return templates.TemplateResponse("catalog.html", {"request": request, "products": products, "q": q or ""})

# @router.get("/products/{pid}")
# def product_detail(request: Request, pid: int, session=Depends(get_session)):
#     p = session.get(Product, pid)
#     if not p or not p.active:
#         return templates.TemplateResponse("product.html", {"request": request, "error": "Not found"}, status_code=404)
#     return templates.TemplateResponse("product.html", {"request": request, "p": p})

# app/catalog.py
from typing import Optional
from fastapi import APIRouter, Depends, Request, Query
from fastapi.templating import Jinja2Templates
from sqlmodel import select
from app.db import get_session
from app.models import Product
import re

router = APIRouter()
templates = Jinja2Templates(directory="app/templates")
HCPCS_RE = re.compile(r"^[A-V]\d{4}$", re.IGNORECASE)  # A-V + four digits


@router.get("/catalog")
def list_products(request: Request, q: Optional[str] = Query(None), session=Depends(get_session)):
    stmt = select(Product).where(Product.active == True)

    if q:
        term = q.strip()
        like = f"%{term}%"
        # default: name/description/SKU
        stmt = stmt.where(
            (Product.name.ilike(like)) |
            (Product.description.ilike(like)) |
            (Product.sku.ilike(like))
        )
        # if it looks like an HCPCS, include hcpcs_code search
        if HCPCS_RE.match(term):
            stmt = select(Product).where(Product.active == True).where(
                (Product.hcpcs_code.ilike(like)) |
                (Product.name.ilike(like)) |
                (Product.description.ilike(like)) |
                (Product.sku.ilike(like))
            )

    products = session.exec(stmt.order_by(Product.name)).all()
    return templates.TemplateResponse(
        "catalog.html",
        {"request": request, "products": products, "q": q or ""}
    )
