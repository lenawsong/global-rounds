"""Mobile patient engagement prototype."""
from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Dict, Iterable, List

from . import utils

DELIVERY_REMINDER_WINDOW_DAYS = 3
RESUPPLY_REMINDER_THRESHOLD_DAYS = 5


def _days_between(target: datetime, as_of: datetime) -> int:
    return (target - as_of).days


def generate_notifications(data_dir: Path, as_of: datetime) -> Dict[str, Iterable[Dict[str, str]]]:
    contacts_rows = utils.load_csv(data_dir / "patient_contacts.csv")
    orders_rows = utils.load_csv(
        data_dir / "order_status.csv",
        parse_dates=["expected_delivery_date", "last_status_update"],
    )
    usage_rows = utils.load_csv(data_dir / "patient_usage.csv")

    contact_lookup = {row["patient_id"]: row for row in contacts_rows}

    patient_messages: List[Dict[str, str]] = []
    case_manager_messages: List[Dict[str, str]] = []

    for order in orders_rows:
        patient_id = order["patient_id"]
        contact = contact_lookup.get(patient_id)
        if not contact:
            continue
        delivery_date = order.get("expected_delivery_date")
        status = order.get("status", "")
        order_id = order.get("order_id", "")

        if isinstance(delivery_date, datetime):
            days_until = _days_between(delivery_date, as_of)
            if 0 <= days_until <= DELIVERY_REMINDER_WINDOW_DAYS and status in {"scheduled", "in_transit"}:
                patient_messages.append(
                    {
                        "patient_id": patient_id,
                        "channel": contact.get("preferred_channel", "sms"),
                        "destination": contact.get("destination"),
                        "template": "delivery_reminder",
                        "order_id": order_id,
                        "message": (
                            f"Hi {contact.get('patient_name')}, your {order.get('supply_sku')} delivery is "
                            f"scheduled for {delivery_date.strftime('%Y-%m-%d')}. Reply HELP for support."
                        ),
                    }
                )

        if status == "hold_compliance":
            case_manager_messages.append(
                {
                    "patient_id": patient_id,
                    "order_id": order_id,
                    "channel": "email",
                    "destination": contact.get("case_manager_email"),
                    "template": "compliance_block",
                    "message": (
                        f"Compliance hold on order {order_id} for {contact.get('patient_name')} "
                        f"({order.get('supply_sku')}). Please review documents."
                    ),
                }
            )

    for row in usage_rows:
        patient_id = row["patient_id"]
        contact = contact_lookup.get(patient_id)
        if not contact:
            continue
        days_remaining = float(row.get("days_supply_remaining", 0) or 0)
        if days_remaining <= RESUPPLY_REMINDER_THRESHOLD_DAYS:
            patient_messages.append(
                {
                    "patient_id": patient_id,
                    "channel": contact.get("preferred_channel", "sms"),
                    "destination": contact.get("destination"),
                    "template": "resupply_checkin",
                    "message": (
                        f"It's time to review your {row.get('supply_sku')} supplies. "
                        "Tap the app or reply YES to confirm you still need a resupply."
                    ),
                }
            )
            if contact.get("risk_level") == "high":
                case_manager_messages.append(
                    {
                        "patient_id": patient_id,
                        "channel": "email",
                        "destination": contact.get("case_manager_email"),
                        "template": "high_risk_resupply",
                        "message": (
                            f"High-risk patient {contact.get('patient_name')} has {days_remaining} "
                            "days left of supplies. Please confirm needs."
                        ),
                    }
                )

    return {
        "patient_messages": patient_messages,
        "case_manager_messages": case_manager_messages,
    }
