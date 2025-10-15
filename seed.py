from app.db import engine, init_db
from sqlmodel import Session, select
from app.models import Product

init_db()

items = [
    # -------------------------
    # Respiratory Therapy & Oxygen Care
    # -------------------------
    {
        "sku": "OXY-PORT-5L",
        "name": "Portable Oxygen Concentrator",
        "description": "FAA-compliant portable oxygen concentrator, 5 LPM.",
        "price_cents": 129900,
        "image_url": None,
        "hcpcs_code": "E1392",  # Oxygen concentrator, portable
        "active": True,
    },
    {
        "sku": "OXY-STAT-5L",
        "name": "Stationary Oxygen Concentrator",
        "description": "Home stationary oxygen concentrator, quiet operation.",
        "price_cents": 99900,
        "image_url": None,
        "hcpcs_code": "E1390",  # Oxygen concentrator, stationary
        "active": True,
    },
    {
        "sku": "OXY-TANK-KIT",
        "name": "Oxygen Tank with Regulator & Humidifier Bottle",
        "description": "Cylinder + regulator kit with humidifier bottle.",
        "price_cents": 34900,
        "image_url": None,
        "hcpcs_code": None,  # kits vary
        "active": True,
    },
    {
        "sku": "NEB-COMP-STD",
        "name": "Standard Nebulizer Compressor System",
        "description": "Durable compressor with nebulizer set.",
        "price_cents": 6999,
        "image_url": None,
        "hcpcs_code": "E0570",
        "active": True,
    },
    {
        "sku": "NEB-PEDI-MASK",
        "name": "Pediatric Nebulizer Mask Set",
        "description": "Pediatric aerosol mask with tubing & neb cup.",
        "price_cents": 1999,
        "image_url": None,
        "hcpcs_code": "A7005",
        "active": True,
    },
    {
        "sku": "NEB-ADULT-SET",
        "name": "Adult Nebulizer Set (Cannula/Mask & Tubing)",
        "description": "Adult kit: mask or cannula, tubing, neb cup.",
        "price_cents": 1799,
        "image_url": None,
        "hcpcs_code": "A7015",
        "active": True,
    },
    {
        "sku": "RESP-NASAL-CANN",
        "name": "Nasal Cannulas (Pack)",
        "description": "Soft nasal cannulas with standard connectors.",
        "price_cents": 1599,
        "image_url": None,
        "hcpcs_code": "A4615",
        "active": True,
    },
    {
        "sku": "RESP-O2-TUBING",
        "name": "Oxygen Tubing (25 ft)",
        "description": "Kink-resistant tubing for oxygen delivery.",
        "price_cents": 1099,
        "image_url": None,
        "hcpcs_code": "A4616",
        "active": True,
    },
    {
        "sku": "RESP-HUMID-CHAMBER",
        "name": "Water Chamber, Reusable",
        "description": "Reusable humidifier water chamber for respiratory devices.",
        "price_cents": 2499,
        "image_url": None,
        "hcpcs_code": None,
        "active": True,
    },
    {
        "sku": "RESP-BACT-FILTER",
        "name": "Bacterial Filter (Inline), Pack of 5",
        "description": "Inline antibacterial filters for respiratory circuits.",
        "price_cents": 2299,
        "image_url": None,
        "hcpcs_code": None,
        "active": True,
    },

    # -------------------------
    # Mobility & Walking Aids
    # -------------------------
    {
        "sku": "WALKER-STD",
        "name": "Adjustable Walker",
        "description": "Lightweight aluminum walker.",
        "price_cents": 4999,
        "image_url": None,
        "hcpcs_code": "E0130",  # Walker, rigid
        "active": True,
    },
    {
        "sku": "WALKER-ROLL-SEAT",
        "name": "Rolling Walker with Seat (Rollator)",
        "description": "4-wheel rollator with hand brakes and seat.",
        "price_cents": 11999,
        "image_url": None,
        "hcpcs_code": "E0143",  # Walker, rigid w/ wheels (closest)
        "active": True,
    },
    {
        "sku": "CANE-LITE",
        "name": "Lightweight Cane",
        "description": "Height-adjustable, non-slip tip.",
        "price_cents": 2499,
        "image_url": None,
        "hcpcs_code": "E0100",
        "active": True,
    },
    {
        "sku": "CRUTCH-STD",
        "name": "Standard Aluminum Crutches (Pair)",
        "description": "Adjustable forearm/underarm crutches with pads.",
        "price_cents": 3999,
        "image_url": None,
        "hcpcs_code": "E0114",
        "active": True,
    },
    {
        "sku": "ROLLATOR-FOREARM",
        "name": "Forearm Support Rollator",
        "description": "Rollator with forearm rests for stability.",
        "price_cents": 16999,
        "image_url": None,
        "hcpcs_code": None,
        "active": True,
    },
    {
        "sku": "MOB-ACCESS-KIT",
        "name": "Mobility Safety Accessory Kit",
        "description": "Glides, tips, and reflective accessories.",
        "price_cents": 2499,
        "image_url": None,
        "hcpcs_code": None,
        "active": True,
    },

    # -------------------------
    # Hospital & Home Care Beds
    # -------------------------
    {
        "sku": "BED-SEMI-EL",
        "name": "Semi-Electric Hospital Bed",
        "description": "Height manual; head/foot electric.",
        "price_cents": 59900,
        "image_url": None,
        "hcpcs_code": "E0260",
        "active": True,
    },
    {
        "sku": "BED-FULL-EL",
        "name": "Full-Electric Hospital Bed",
        "description": "Fully electric height and positioning.",
        "price_cents": 89900,
        "image_url": None,
        "hcpcs_code": "E0265",
        "active": True,
    },
    {
        "sku": "BED-BARIATRIC",
        "name": "Bariatric Bed System",
        "description": "Heavy-duty frame for bariatric patients.",
        "price_cents": 189900,
        "image_url": None,
        "hcpcs_code": None,  # model-specific
        "active": True,
    },
    {
        "sku": "BED-PEDS",
        "name": "Pediatric Bed System",
        "description": "Safe, adjustable pediatric bed.",
        "price_cents": 129900,
        "image_url": None,
        "hcpcs_code": None,
        "active": True,
    },
    {
        "sku": "OVERBED-TABLE",
        "name": "Overbed Table",
        "description": "Height-adjustable bedside table.",
        "price_cents": 14999,
        "image_url": None,
        "hcpcs_code": "E0274",
        "active": True,
    },
    {
        "sku": "BED-RAILS",
        "name": "Safety Side Rails (Pair)",
        "description": "Tool-less install safety rails for hospital/home beds.",
        "price_cents": 8999,
        "image_url": None,
        "hcpcs_code": "E0310",
        "active": True,
    },

    # -------------------------
    # Pressure Injury Prevention
    # -------------------------
    {
        "sku": "MATT-ALT-AIR",
        "name": "Alternating Pressure Mattress with Pump",
        "description": "Dynamic air system for pressure relief.",
        "price_cents": 179900,
        "image_url": None,
        "hcpcs_code": "E0277",
        "active": True,
    },
    {
        "sku": "MATT-LOW-AIR",
        "name": "Low-Air-Loss Mattress",
        "description": "Moisture/temperature management for skin protection.",
        "price_cents": 219900,
        "image_url": None,
        "hcpcs_code": None,
        "active": True,
    },
    {
        "sku": "OVERLAY-GEL",
        "name": "Gel Overlay Mattress",
        "description": "Gel overlay for pressure redistribution.",
        "price_cents": 59900,
        "image_url": None,
        "hcpcs_code": "E0185",
        "active": True,
    },
    {
        "sku": "CUSHION-POSITION",
        "name": "Positioning Cushions (Set)",
        "description": "Multi-position foam/gel cushions.",
        "price_cents": 34900,
        "image_url": None,
        "hcpcs_code": None,
        "active": True,
    },

    # -------------------------
    # Orthotic Supports
    # -------------------------
    {
        "sku": "KNEE-HINGED",
        "name": "Post-Surgical Hinged Knee Brace",
        "description": "Adjustable ROM hinges; breathable liners.",
        "price_cents": 7999,
        "image_url": None,
        "hcpcs_code": "L1833",
        "active": True,
    },
    {
        "sku": "KNEE-SLEEVE",
        "name": "Knee Stabilizing Sleeve",
        "description": "Compression sleeve for knee support.",
        "price_cents": 2999,
        "image_url": None,
        "hcpcs_code": "L1810",
        "active": True,
    },
    {
        "sku": "WRIST-CARPAL",
        "name": "Carpal Tunnel Wrist Brace",
        "description": "Removable aluminum stay; adjustable straps.",
        "price_cents": 2199,
        "image_url": None,
        "hcpcs_code": "L3908",
        "active": True,
    },
    {
        "sku": "HAND-RESTING",
        "name": "Resting Hand Splint",
        "description": "Functional hand positioning for recovery.",
        "price_cents": 6999,
        "image_url": None,
        "hcpcs_code": "L3807",
        "active": True,
    },

    # -------------------------
    # Home Care Accessories
    # -------------------------
    {
        "sku": "BATH-SAFETY-GRAB",
        "name": "Grab Bars (Pair)",
        "description": "Stainless, textured grip, multiple lengths.",
        "price_cents": 4999,
        "image_url": None,
        "hcpcs_code": None,
        "active": True,
    },
    {
        "sku": "BATH-SHOWER-CHAIR",
        "name": "Shower Chair with Back",
        "description": "Height-adjustable legs, non-slip feet.",
        "price_cents": 5499,
        "image_url": None,
        "hcpcs_code": "E0240",
        "active": True,
    },
    {
        "sku": "BATH-RAISED-TOILET",
        "name": "Raised Toilet Seat",
        "description": "Adds height; secure clamp; easy to clean.",
        "price_cents": 3999,
        "image_url": None,
        "hcpcs_code": "E0244",
        "active": True,
    },

    # -------------------------
    # Wheelchair Basics (one example with code)
    # -------------------------
    {
        "sku": "WHEELCHAIR-18",
        "name": "Standard Manual Wheelchair 18\"",
        "description": "Folding steel frame, removable leg rests.",
        "price_cents": 139900,
        "image_url": None,
        "hcpcs_code": "K0001",
        "active": True,
    },
]

# Upsert into DB
with Session(engine) as s:
    for data in items:
        existing = s.exec(select(Product).where(Product.sku == data["sku"])).first()
        if existing:
            for key, val in data.items():
                setattr(existing, key, val)
            s.add(existing)
        else:
            s.add(Product(**data))
    s.commit()

print("Seeded.")
