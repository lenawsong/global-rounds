from app.db import engine, init_db
from sqlmodel import Session, select
from app.models import Product

init_db()
items = [
    {"sku":"WALKER-STD","name":"Adjustable Walker","description":"Lightweight aluminum walker.","price_cents":4999,"image_url":None,"active":True},
    {"sku":"WHEELCHAIR-18","name":"Wheelchair 18\"","description":"Folding steel frame.","price_cents":12999,"image_url":None,"active":True},
]
with Session(engine) as s:
    for p in items:
        exists = s.exec(select(Product).where(Product.sku == p["sku"])).first()
        if not exists:
            s.add(Product(**p))
    s.commit()
print("Seeded.")
