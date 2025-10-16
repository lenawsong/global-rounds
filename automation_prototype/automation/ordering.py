"""Automated ordering & reordering prototype."""
from __future__ import annotations

import json
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Iterable, List, Mapping, Optional, Tuple

from . import utils
from .predictive_inventory import forecast_inventory

PATIENT_REORDER_THRESHOLD_DAYS = 7
DEFAULT_SUPPLY_DAYS = 30


@dataclass
class InventoryRecommendation:
    supply_sku: str
    suggested_order_qty: int
    rationale: str

    def to_dict(self) -> Dict[str, str]:
        return {
            "supply_sku": self.supply_sku,
            "suggested_order_qty": self.suggested_order_qty,
            "rationale": self.rationale,
        }


def _to_float(value: object, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _to_int(value: object, default: int = 0) -> int:
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


def generate_patient_work_orders(data_dir: Path, as_of: datetime) -> Tuple[List[utils.WorkOrder], List[utils.Alert]]:
    usage_rows = utils.load_csv(data_dir / "patient_usage.csv", parse_dates=["last_fulfillment_date"])
    compliance_rows = utils.load_csv(data_dir / "compliance_status.csv", parse_dates=["next_due_date"])
    inventory_rows = utils.load_csv(data_dir / "inventory_levels.csv")

    inventory_lookup = {row["supply_sku"]: row for row in inventory_rows}
    compliance_lookup = {
        (row["patient_id"], row["supply_sku"]): row for row in compliance_rows
    }

    work_orders: List[utils.WorkOrder] = []
    alerts: List[utils.Alert] = []

    for row in usage_rows:
        patient_id = row["patient_id"]
        sku = row["supply_sku"]
        avg_daily_use = _to_float(row.get("avg_daily_use"))
        days_remaining = _to_float(row.get("days_supply_remaining"))
        depletion_date = as_of + timedelta(days=days_remaining)

        if days_remaining > PATIENT_REORDER_THRESHOLD_DAYS:
            continue

        standard_quantity = max(int(avg_daily_use * DEFAULT_SUPPLY_DAYS), 1)
        compliance_status = "clear"
        notes: List[str] = []

        compliance_row = compliance_lookup.get((patient_id, sku))
        if compliance_row:
            issues: List[str] = []
            if compliance_row.get("f2f_status") != "current":
                issues.append("F2F expired")
            if compliance_row.get("wopd_status") != "on_file":
                issues.append("WOPD missing")
            prior_auth = compliance_row.get("prior_auth_status")
            if prior_auth not in {"approved", "not_required"}:
                issues.append("Prior auth pending")
            due_date = compliance_row.get("next_due_date")
            if isinstance(due_date, datetime) and due_date <= depletion_date:
                issues.append("Compliance due before fulfillment")
            if issues:
                compliance_status = "hold"
                notes.extend(issues)
        else:
            compliance_status = "unknown"
            notes.append("No compliance record")

        inventory_row = inventory_lookup.get(sku)
        if inventory_row:
            on_hand = _to_int(inventory_row.get("on_hand_units"))
            if on_hand < standard_quantity:
                notes.append(f"Low warehouse inventory ({on_hand})")
        else:
            notes.append("SKU missing from inventory table")

        work_orders.append(
            utils.WorkOrder(
                patient_id=patient_id,
                supply_sku=sku,
                required_date=depletion_date,
                quantity=standard_quantity,
                compliance_status=compliance_status,
                notes="; ".join(notes) if notes else "",
            )
        )

        if compliance_status != "clear":
            alerts.append(
                utils.Alert(
                    severity="high" if compliance_status == "hold" else "medium",
                    message=f"Compliance issue for patient {patient_id} / {sku}",
                    metadata={"notes": "; ".join(notes) if notes else ""},
                )
            )

    return work_orders, alerts


def recommend_inventory_reorders(
    data_dir: Path,
    as_of: datetime,
    growth_adjustment: float = 0.0,
) -> List[InventoryRecommendation]:
    inventory_rows = utils.load_csv(data_dir / "inventory_levels.csv")
    usage_rows = utils.load_csv(data_dir / "patient_usage.csv")

    demand_by_sku: Dict[str, float] = defaultdict(float)
    for row in usage_rows:
        sku = row["supply_sku"]
        avg_daily_use = _to_float(row.get("avg_daily_use"))
        demand_by_sku[sku] += avg_daily_use * DEFAULT_SUPPLY_DAYS

    forecasts = forecast_inventory(data_dir, as_of, growth_adjustment=growth_adjustment)
    recommendations: List[InventoryRecommendation] = []
    for row in inventory_rows:
        sku = row["supply_sku"]
        on_hand = _to_int(row.get("on_hand_units"))
        reorder_point = _to_int(row.get("reorder_point_units"))
        lead_time_days = _to_int(row.get("lead_time_days"), 14)
        projected_demand = demand_by_sku.get(sku, 0.0)

        forecast_entry = forecasts.get(sku)
        if forecast_entry:
            projected_demand = max(projected_demand, float(forecast_entry.get("forecast_units", 0.0)))
            reorder_point = max(reorder_point, int(float(forecast_entry.get("recommended_buffer", 0.0))))

        if on_hand <= reorder_point:
            suggested_qty = max(int(projected_demand - on_hand), reorder_point)
            rationale = (
                f"On hand {on_hand} <= reorder point {reorder_point}; "
                f"forecast demand {int(projected_demand)}; lead time {lead_time_days} days"
            )
            recommendations.append(
                InventoryRecommendation(
                    supply_sku=sku,
                    suggested_order_qty=suggested_qty,
                    rationale=rationale,
                )
            )

    return recommendations


def run(data_dir: Path, as_of: datetime) -> Dict[str, Iterable[Dict[str, str]]]:
    work_orders, alerts = generate_patient_work_orders(data_dir, as_of)
    portal_orders = _load_portal_orders(data_dir)
    vendor_orders = recommend_inventory_reorders(data_dir, as_of)

    for order in portal_orders:
        compliance_status = order.get("ai_compliance_status") or order.get("compliance_status") or "unknown"
        required = _safe_parse_date(order.get("requested_date")) or (as_of + timedelta(days=2))
        notes: List[str] = []
        status = order.get("status", "pending_review")
        if order.get("ai_notes"):
            notes.extend([str(note) for note in order.get("ai_notes", [])])
        notes.insert(0, f"Portal order ({status})")
        work_orders.append(
            utils.WorkOrder(
                patient_id=str(order.get("patient_id", "")),
                supply_sku=str(order.get("supply_sku", "")),
                required_date=required,
                quantity=_to_int(order.get("quantity"), 0),
                compliance_status=str(compliance_status),
                notes="; ".join(notes),
            )
        )

        if status != "approved":
            alerts.append(
                utils.Alert(
                    severity="high" if compliance_status == "hold" else "medium",
                    message=f"Portal order {order.get('id', '')} requires review",
                    metadata={"notes": "; ".join(notes[1:]) if len(notes) > 1 else status},
                )
            )

    return {
        "patient_work_orders": [order.to_dict() for order in work_orders],
        "compliance_alerts": [alert.to_dict() for alert in alerts],
        "vendor_reorders": [rec.to_dict() for rec in vendor_orders],
    }


def assess_portal_order(
    data_dir: Path,
    *,
    patient_id: str,
    supply_sku: str,
    quantity: int,
    requested_date: Optional[str],
    as_of: datetime,
) -> Mapping[str, object]:
    usage_rows = utils.load_csv(data_dir / "patient_usage.csv", parse_dates=["last_fulfillment_date"])
    compliance_rows = utils.load_csv(data_dir / "compliance_status.csv", parse_dates=["next_due_date"])
    inventory_rows = utils.load_csv(data_dir / "inventory_levels.csv")

    compliance_lookup = {
        (row["patient_id"], row["supply_sku"]): row for row in compliance_rows
    }
    inventory_lookup = {row["supply_sku"]: row for row in inventory_rows}

    recommended_quantity = max(int(quantity or 0), 1)
    for row in usage_rows:
        if row["patient_id"] == patient_id and row["supply_sku"] == supply_sku:
            avg_daily_use = _to_float(row.get("avg_daily_use"))
            if avg_daily_use:
                recommended_quantity = max(int(avg_daily_use * DEFAULT_SUPPLY_DAYS), 1)
            break

    notes: List[str] = []
    compliance_status = "clear"

    compliance_row = compliance_lookup.get((patient_id, supply_sku))
    if not compliance_row:
        compliance_status = "unknown"
        notes.append("No compliance record on file.")
    else:
        issues: List[str] = []
        if compliance_row.get("f2f_status") != "current":
            issues.append("F2F expired")
        if compliance_row.get("wopd_status") != "on_file":
            issues.append("WOPD missing")
        prior_auth = compliance_row.get("prior_auth_status")
        if prior_auth not in {"approved", "not_required"}:
            issues.append("Prior auth pending")
        due_date = compliance_row.get("next_due_date")
        requested_dt = _safe_parse_date(requested_date)
        compare_date = requested_dt or (as_of + timedelta(days=2))
        if isinstance(due_date, datetime) and due_date <= compare_date:
            issues.append("Compliance due before requested ship date")
        if issues:
            compliance_status = "hold"
            notes.extend(issues)

    recommended_fulfillment = "warehouse"
    inventory_row = inventory_lookup.get(supply_sku)
    if inventory_row:
        on_hand = _to_int(inventory_row.get("on_hand_units"))
        if on_hand < recommended_quantity:
            notes.append(f"Warehouse inventory low ({on_hand} on hand)")
            recommended_fulfillment = "dropship"
    else:
        notes.append("SKU missing from inventory table")
        recommended_fulfillment = "dropship"

    disposition = "approved" if compliance_status == "clear" else "requires_review"

    return {
        "disposition": disposition,
        "compliance_status": compliance_status,
        "notes": notes,
        "recommended_quantity": recommended_quantity,
        "recommended_fulfillment": recommended_fulfillment,
    }


def _load_portal_orders(data_dir: Path) -> List[Mapping[str, object]]:
    path = data_dir / "portal_orders.json"
    if not path.exists():
        return []
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []
    orders = payload.get("orders", []) if isinstance(payload, dict) else payload
    return [order for order in orders if order.get("status") not in {"cancelled", "void"}]


def _safe_parse_date(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return utils.parse_date(str(value))
    except ValueError:
        return None
