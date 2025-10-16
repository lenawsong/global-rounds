"""Partner API helpers for external DME shops."""
from __future__ import annotations

import json
import uuid
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Iterable, List, Mapping, MutableMapping, Optional

from automation import utils as automation_utils

DEFAULT_ORDER_FEE = 18.0  # synthetic billing assumption per compliant order


@dataclass
class PartnerOrder:
    order_id: str
    partner_id: str
    patient_id: str
    supply_sku: str
    quantity: int
    status: str
    compliance_passed: bool
    is_paid: bool
    amount_paid: float
    created_at: datetime
    updated_at: datetime
    metadata: Mapping[str, object]

    def to_dict(self) -> Mapping[str, object]:
        return {
            "order_id": self.order_id,
            "partner_id": self.partner_id,
            "patient_id": self.patient_id,
            "supply_sku": self.supply_sku,
            "quantity": self.quantity,
            "status": self.status,
            "compliance_passed": self.compliance_passed,
            "is_paid": self.is_paid,
            "amount_paid": round(self.amount_paid, 2),
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "metadata": dict(self.metadata),
        }


class PartnerOrderStore:
    """Persist partner-submitted orders and compute usage charges."""

    def __init__(self, data_dir: Path) -> None:
        self.data_dir = Path(data_dir)
        self.path = self.data_dir / "partner_orders.json"
        self._orders: Dict[str, Mapping[str, object]] = {}
        self._load()

    # ------------------------------------------------------------------
    # Persistence
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
        self._orders = {str(entry.get("order_id")): dict(entry) for entry in records}

    def _persist(self) -> None:
        automation_utils.ensure_directory(self.path.parent)
        snapshot = {"orders": list(self._orders.values())}
        self.path.write_text(json.dumps(snapshot, indent=2), encoding="utf-8")

    # ------------------------------------------------------------------
    # CRUD
    # ------------------------------------------------------------------
    def create_order(
        self,
        *,
        partner_id: str,
        patient_id: str,
        supply_sku: str,
        quantity: int,
        metadata: Optional[Mapping[str, object]] = None,
    ) -> Mapping[str, object]:
        now = datetime.now(timezone.utc)
        order_id = f"PARTNER-{uuid.uuid4().hex[:10].upper()}"
        record = PartnerOrder(
            order_id=order_id,
            partner_id=partner_id,
            patient_id=patient_id,
            supply_sku=supply_sku,
            quantity=quantity,
            status="received",
            compliance_passed=False,
            is_paid=False,
            amount_paid=0.0,
            created_at=now,
            updated_at=now,
            metadata=metadata or {},
        ).to_dict()
        self._orders[order_id] = record
        self._persist()
        return dict(record)

    def update_order(
        self,
        order_id: str,
        *,
        status: Optional[str] = None,
        compliance_passed: Optional[bool] = None,
        amount_paid: Optional[float] = None,
        metadata_updates: Optional[Mapping[str, object]] = None,
    ) -> Mapping[str, object]:
        if order_id not in self._orders:
            raise KeyError(f"Partner order {order_id} not found")
        record = dict(self._orders[order_id])
        if status:
            record["status"] = status
        if compliance_passed is not None:
            record["compliance_passed"] = bool(compliance_passed)
        if amount_paid is not None:
            record["amount_paid"] = float(amount_paid)
            record["is_paid"] = float(amount_paid) > 0
        metadata = dict(record.get("metadata") or {})
        if metadata_updates:
            metadata.update({key: value for key, value in metadata_updates.items() if value is not None})
        record["metadata"] = metadata
        record["updated_at"] = datetime.now(timezone.utc).isoformat()
        self._orders[order_id] = record
        self._persist()
        return dict(record)

    def list_orders(self, *, partner_id: Optional[str] = None) -> List[Mapping[str, object]]:
        orders = list(self._orders.values())
        if partner_id:
            orders = [order for order in orders if str(order.get("partner_id")) == partner_id]
        orders.sort(key=lambda item: item.get("created_at", ""), reverse=True)
        return [dict(order) for order in orders]

    # ------------------------------------------------------------------
    # Usage / billing
    # ------------------------------------------------------------------
    def usage_summary(
        self,
        *,
        partner_id: str,
        month: Optional[str] = None,
        order_fee: float = DEFAULT_ORDER_FEE,
    ) -> Mapping[str, object]:
        orders = self.list_orders(partner_id=partner_id)
        if month:
            orders = [order for order in orders if str(order.get("created_at", ""))[:7] == month]
        compliant_paid = [
            order
            for order in orders
            if order.get("is_paid") and order.get("compliance_passed")
        ]
        total_charges = round(len(compliant_paid) * order_fee, 2)
        return {
            "partner_id": partner_id,
            "month": month,
            "orders_total": len(orders),
            "compliant_paid_orders": len(compliant_paid),
            "order_fee": order_fee,
            "total_charges": total_charges,
            "orders": compliant_paid,
        }
