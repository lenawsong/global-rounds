"""Provider-facing helpers for documentation templates."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Mapping, Optional


def render_wopd_template(patient_id: str, supply_sku: str, metadata: Mapping[str, object] | None = None) -> str:
    """Return a simple HTML stub for WOPD completion."""

    details = metadata or {}
    requested_date = details.get("target_date") or datetime.utcnow().date().isoformat()
    notes = details.get("notes") or ""

    return (
        "<html><head><meta charset='utf-8'><title>WOPD Summary</title>"
        "<style>body{font-family:Arial,sans-serif;margin:24px;}"
        "h1{font-size:22px;margin-bottom:8px;}"
        "table{border-collapse:collapse;width:100%;margin-top:16px;}"
        "td,th{border:1px solid #ccc;padding:8px;text-align:left;}"
        ".small{color:#555;font-size:12px;}</style></head><body>"
        f"<h1>Written Order Prior to Delivery</h1>"
        f"<p class='small'>Generated {datetime.utcnow().isoformat()}Z</p>"
        "<table>"
        f"<tr><th>Patient ID</th><td>{patient_id}</td></tr>"
        f"<tr><th>Supply SKU</th><td>{supply_sku}</td></tr>"
        f"<tr><th>Requested Fulfillment Date</th><td>{requested_date}</td></tr>"
        f"<tr><th>Notes</th><td>{notes}</td></tr>"
        "</table>"
        "<p class='small'>This is a draft summary. Clinician signature and supporting documentation are still required.</p>"
        "</body></html>"
    )


def render_f2f_template(patient_id: str, supply_sku: str, metadata: Mapping[str, object] | None = None) -> str:
    """Create a face-to-face encounter summary stub."""

    details = metadata or {}
    encounter_date = details.get("encounter_date") or datetime.utcnow().date().isoformat()
    clinician = details.get("clinician") or "Attending Clinician"
    location = details.get("location") or "Primary care clinic"
    notes = details.get("notes") or "Document medical necessity and confirmation of patient encounter."

    return (
        "<html><head><meta charset='utf-8'><title>Face-to-Face Encounter</title>"
        "<style>body{font-family:Arial,sans-serif;margin:24px;}"
        "h1{font-size:22px;margin-bottom:8px;}"
        "table{border-collapse:collapse;width:100%;margin-top:16px;}"
        "td,th{border:1px solid #ccc;padding:8px;text-align:left;}"
        ".small{color:#555;font-size:12px;}</style></head><body>"
        "<h1>Face-to-Face Encounter Summary</h1>"
        f"<p class='small'>Generated {datetime.utcnow().isoformat()}Z</p>"
        "<table>"
        f"<tr><th>Patient ID</th><td>{patient_id}</td></tr>"
        f"<tr><th>Supply SKU</th><td>{supply_sku}</td></tr>"
        f"<tr><th>Encounter Date</th><td>{encounter_date}</td></tr>"
        f"<tr><th>Clinician</th><td>{clinician}</td></tr>"
        f"<tr><th>Location</th><td>{location}</td></tr>"
        f"<tr><th>Notes</th><td>{notes}</td></tr>"
        "</table>"
        "<p class='small'>Attach supporting vitals and evaluation notes to complete the payer packet.</p>"
        "</body></html>"
    )


def create_esign_stub(
    *,
    task_id: Optional[str] = None,
    patient_id: Optional[str] = None,
    supply_sku: Optional[str] = None,
    signer_name: Optional[str] = None,
    signer_email: Optional[str] = None,
) -> Mapping[str, object]:
    """Return a simulated e-sign envelope payload."""

    envelope_id = f"ESIGN-{uuid.uuid4().hex[:10].upper()}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=3)
    return {
        "envelope_id": envelope_id,
        "status": "sent",
        "sign_url": f"https://example.com/esign/{envelope_id}",
        "expires_at": expires_at.isoformat(),
        "metadata": {
            "task_id": task_id,
            "patient_id": patient_id,
            "supply_sku": supply_sku,
            "signer_name": signer_name,
            "signer_email": signer_email,
        },
    }
