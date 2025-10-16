"""Portal order store and business logic."""
from __future__ import annotations

import json
import threading
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Mapping, MutableMapping, Optional

from automation import ordering
from automation import utils as automation_utils


@dataclass
class OrderAssessment:
    disposition: str
    compliance_status: str
    notes: List[str] = field(default_factory=list)
    recommended_quantity: int = 0
    recommended_fulfillment: str = "warehouse"

    def to_dict(self) -> Mapping[str, object]:
        return {
            "disposition": self.disposition,
            "compliance_status": self.compliance_status,
            "notes": self.notes,
            "recommended_quantity": self.recommended_quantity,
            "recommended_fulfillment": self.recommended_fulfillment,
        }


class PortalOrderStore:
    """Lightweight persistence for portal-submitted orders."""

    def __init__(self, data_dir: Path) -> None:
        self.data_dir = data_dir
        self.path = self.data_dir / "portal_orders.json"
        self._lock = threading.Lock()
        self._orders: MutableMapping[str, MutableMapping[str, object]] = {}
        self._load()

    # ------------------------------------------------------------------
    # Persistence helpers
    # ------------------------------------------------------------------
    def _load(self) -> None:
        if not self.path.exists():
            self._orders = {}
            return
        try:
            payload = json.loads(self.path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            payload = {"orders": []}
        records = payload.get("orders", []) if isinstance(payload, dict) else payload
        self._orders = {
            record.get("id", str(uuid.uuid4())): dict(record)
            for record in records
        }

    def _persist(self) -> None:
        automation_utils.ensure_directory(self.path.parent)
        snapshot = {"orders": list(self._orders.values())}
        self.path.write_text(json.dumps(snapshot, indent=2), encoding="utf-8")

    # ------------------------------------------------------------------
    # CRUD operations
    # ------------------------------------------------------------------
    def list_orders(self, status: Optional[str] = None) -> List[Mapping[str, object]]:
        with self._lock:
            orders = list(self._orders.values())
            if status:
                desired = {state.strip().lower() for state in status.split(",")}
                orders = [order for order in orders if str(order.get("status", "")).lower() in desired]
            orders.sort(key=lambda item: item.get("created_at", ""), reverse=True)
            return [dict(order) for order in orders]

    def get_order(self, order_id: str) -> Optional[Mapping[str, object]]:
        with self._lock:
            order = self._orders.get(order_id)
            return dict(order) if order else None

    def create_order(
        self,
        payload: Mapping[str, object],
        assessment: OrderAssessment,
        as_of: datetime,
    ) -> Mapping[str, object]:
        with self._lock:
            order_id = payload.get("id") or self._generate_id()
            now = datetime.now(timezone.utc)
            recommended_quantity = assessment.recommended_quantity or int(payload.get("quantity", 0) or 0)
            status = self._initial_status(assessment)
            order = {
                "id": order_id,
                "patient_id": payload.get("patient_id"),
                "supply_sku": payload.get("supply_sku"),
                "quantity": recommended_quantity,
                "recommended_quantity": assessment.recommended_quantity or recommended_quantity,
                "requested_date": payload.get("requested_date"),
                "priority": payload.get("priority", "normal"),
                "delivery_mode": payload.get("delivery_mode") or assessment.recommended_fulfillment,
                "recommended_fulfillment": assessment.recommended_fulfillment,
                "notes": payload.get("notes", ""),
                "status": status,
                "ai_disposition": assessment.disposition,
                "ai_compliance_status": assessment.compliance_status,
                "ai_notes": assessment.notes,
                "source": payload.get("source", "portal"),
                "created_at": now.isoformat(),
                "updated_at": now.isoformat(),
                "as_of": as_of.isoformat(),
                "events": [
                    self._event_entry("created", "portal", "Order created through portal."),
                    self._event_entry(f"ai_{assessment.disposition}", "automation", self._ai_summary(assessment)),
                ],
            }
            if status == "approved":
                order["events"].append(
                    self._event_entry("approved", "automation", "Automatically approved by compliance checks."),
                )
            self._orders[order_id] = order
            self._persist()
            return dict(order)

    def update_status(self, order_id: str, status: str, actor: str, note: str | None = None) -> Mapping[str, object]:
        with self._lock:
            if order_id not in self._orders:
                raise KeyError(f"Order {order_id} not found")
            now = datetime.now(timezone.utc)
            order = self._orders[order_id]
            order["status"] = status
            order["updated_at"] = now.isoformat()
            order.setdefault("events", []).append(
                self._event_entry(status, actor, note or f"Status updated to {status} by {actor}"),
            )
            self._persist()
            return dict(order)

    def append_event(self, order_id: str, code: str, actor: str, note: str) -> Mapping[str, object]:
        with self._lock:
            if order_id not in self._orders:
                raise KeyError(f"Order {order_id} not found")
            order = self._orders[order_id]
            order.setdefault("events", []).append(self._event_entry(code, actor, note))
            self._persist()
            return dict(order)

    def update_ai_disposition(
        self,
        order_id: str,
        disposition: str,
        *,
        notes: Optional[List[str]] = None,
        actor: str = "provider",
    ) -> Mapping[str, object]:
        with self._lock:
            if order_id not in self._orders:
                raise KeyError(f"Order {order_id} not found")
            order = self._orders[order_id]
            now = datetime.now(timezone.utc)
            order["ai_disposition"] = disposition
            if notes:
                order["ai_notes"] = list(notes)
            else:
                order.setdefault("ai_notes", [])
            order["updated_at"] = now.isoformat()
            order.setdefault("events", []).append(
                self._event_entry(f"ai_{disposition}", actor, f"AI disposition updated to {disposition} via {actor}"),
            )
            self._persist()
            return dict(order)

    # ------------------------------------------------------------------
    # Utilities
    # ------------------------------------------------------------------
    def _generate_id(self) -> str:
        return f"ORD-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

    @staticmethod
    def _initial_status(assessment: OrderAssessment) -> str:
        if assessment.disposition == "approved":
            return "approved"
        return "pending_review"

    @staticmethod
    def _ai_summary(assessment: OrderAssessment) -> str:
        if not assessment.notes:
            return f"AI disposition: {assessment.disposition}."
        joined = "; ".join(assessment.notes)
        return f"AI disposition: {assessment.disposition}. Findings: {joined}."

    @staticmethod
    def _event_entry(code: str, actor: str, note: str) -> Mapping[str, str]:
        return {
            "code": code,
            "actor": actor,
            "note": note,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }


def assess_order(
    data_dir: Path,
    *,
    patient_id: str,
    supply_sku: str,
    quantity: int,
    requested_date: Optional[str],
    as_of: datetime,
) -> OrderAssessment:
    summary = ordering.assess_portal_order(
        data_dir,
        patient_id=patient_id,
        supply_sku=supply_sku,
        quantity=quantity,
        requested_date=requested_date,
        as_of=as_of,
    )
    return OrderAssessment(
        disposition=summary.get("disposition", "requires_review"),
        compliance_status=summary.get("compliance_status", "unknown"),
        notes=list(summary.get("notes", [])),
        recommended_quantity=int(summary.get("recommended_quantity", quantity) or quantity),
        recommended_fulfillment=summary.get("recommended_fulfillment", "warehouse"),
    )
