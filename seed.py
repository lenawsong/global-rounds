from app.db import engine, init_db
from sqlmodel import Session, select
from app.models import Product

init_db()

items = [
    {
        "sku": "WALKER-STD",
        "name": "Adjustable Walker",
        "description": "Lightweight aluminum walker.",
        "price_cents": 4999,
        "image_url": None,
        "hcpcs_code": None,   # add later if you get a code
        "active": True,
    },
    {
        "sku": "WHEELCHAIR-18",
        "name": "Wheelchair 18\"",
        "description": "Folding steel frame.",
        "price_cents": 12999,
        "image_url": None,
        "hcpcs_code": None,
        "active": True,
    },
    {
        "sku": "OXY-PORT-5L",
        "name": "Portable Oxygen Concentrator",
        "description": "FAA compliant 5 LPM.",
        "price_cents": 129900,
        "image_url": None,
        "hcpcs_code": "E1392",
        "active": True,
    },
    {
        "sku": "OXY-STAT-5L",
        "name": "Stationary Oxygen Concentrator",
        "description": "Quiet, home use.",
        "price_cents": 99900,
        "image_url": None,
        "hcpcs_code": "E1390",
        "active": True,
    },
]

with Session(engine) as s:
    for data in items:
        existing = s.exec(select(Product).where(Product.sku == data["sku"])).first()
        if existing:
            # upsert: update existing fields (so you can add hcpcs_code later without deleting)
            for key, val in data.items():
                setattr(existing, key, val)
            s.add(existing)
        else:
            s.add(Product(**data))
    s.commit()

print("Seeded.")
