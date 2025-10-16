"""Deterministic payer connector helpers."""
from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Mapping, MutableMapping, Optional

from automation import utils as automation_utils


@dataclass
class EligibilityResult:
    patient_id: str
    payer_id: str
    policy_number: str
    coverage_status: str
    deductible_met: bool
    copay_amount: float
    effective_date: datetime
    checked_at: datetime

    def to_dict(self) -> Mapping[str, object]:
        return {
            "patient_id": self.patient_id,
            "payer_id": self.payer_id,
            "policy_number": self.policy_number,
            "coverage_status": self.coverage_status,
            "deductible_met": self.deductible_met,
            "copay_amount": round(self.copay_amount, 2),
            "effective_date": self.effective_date.isoformat(),
            "checked_at": self.checked_at.isoformat(),
        }


@dataclass
class PriorAuthResult:
    order_id: str
    payer_id: str
    auth_number: str
    status: str
    reason: str
    expires_at: datetime

    def to_dict(self) -> Mapping[str, object]:
        return {
            "order_id": self.order_id,
            "payer_id": self.payer_id,
            "auth_number": self.auth_number,
            "status": self.status,
            "reason": self.reason,
            "expires_at": self.expires_at.isoformat(),
        }


@dataclass
class RemitResult:
    remit_id: str
    claim_id: str
    payer_id: str
    order_id: Optional[str]
    amount_billed: float
    amount_paid: float
    variance: float
    status: str
    processed_at: datetime
    tasks_closed: tuple[str, ...]

    def to_dict(self) -> Mapping[str, object]:
        return {
            "remit_id": self.remit_id,
            "claim_id": self.claim_id,
            "payer_id": self.payer_id,
            "order_id": self.order_id,
            "amount_billed": round(self.amount_billed, 2),
            "amount_paid": round(self.amount_paid, 2),
            "variance": round(self.variance, 2),
            "status": self.status,
            "processed_at": self.processed_at.isoformat(),
            "tasks_closed": list(self.tasks_closed),
        }


class PayerConnector:
    """Synthetic payer adapters that emit deterministic results."""

    def __init__(self, data_dir: Path, dispatcher, task_store) -> None:
        self.data_dir = Path(data_dir)
        self.dispatcher = dispatcher
        self.task_store = task_store
        self._remit_log = self.data_dir / "payer_remits.jsonl"

    # ------------------------------------------------------------------
    # Eligibility
    # ------------------------------------------------------------------
    def eligibility_check(
        self,
        *,
        patient_id: str,
        payer_id: str,
        policy_number: str,
        date_of_service: Optional[datetime] = None,
    ) -> EligibilityResult:
        cleaned = "".join(ch for ch in str(policy_number) if ch.isdigit())
        now = datetime.now(timezone.utc)
        effective = (date_of_service or now) - timedelta(days=180)
        if not cleaned:
            coverage = "needs_review"
            deductible_met = False
            copay = 35.0
        else:
            last_digit = int(cleaned[-1])
            coverage = "active" if last_digit % 2 == 0 else "inactive"
            deductible_met = last_digit % 3 == 0
            copay = 10.0 + (last_digit % 4) * 5.0
        result = EligibilityResult(
            patient_id=patient_id,
            payer_id=payer_id,
            policy_number=policy_number,
            coverage_status=coverage,
            deductible_met=deductible_met,
            copay_amount=copay,
            effective_date=effective.replace(tzinfo=timezone.utc),
            checked_at=now,
        )
        self.dispatcher.publish(
            "payer.updated",
            {
                "event": "eligibility_checked",
                "patient_id": patient_id,
                "payer_id": payer_id,
                "policy_number": policy_number,
                "coverage_status": coverage,
                "checked_at": result.checked_at.isoformat(),
            },
        )
        return result

    # ------------------------------------------------------------------
    # Prior authorization
    # ------------------------------------------------------------------
    def prior_auth_status(
        self,
        *,
        order_id: str,
        payer_id: str,
        auth_number: str,
        supply_sku: Optional[str] = None,
    ) -> PriorAuthResult:
        normalized = str(auth_number or "").strip().upper()
        score = sum(ord(ch) for ch in normalized) % 7 if normalized else 0
        status_map = {
            0: "pending",
            1: "approved",
            2: "approved",
            3: "needs_docs",
            4: "pending",
            5: "denied",
            6: "approved",
        }
        status = status_map.get(score, "pending")
        reason = {
            "approved": "Authorization validated via deterministic rules.",
            "needs_docs": "Additional clinical notes requested.",
            "denied": "Coverage criteria not met.",
            "pending": "Awaiting payer decision.",
        }[status]
        expires = datetime.now(timezone.utc) + timedelta(days=30 if status == "approved" else 10)
        result = PriorAuthResult(
            order_id=order_id,
            payer_id=payer_id,
            auth_number=auth_number,
            status=status,
            reason=reason if supply_sku is None else f"{reason} SKU {supply_sku}.",
            expires_at=expires,
        )
        self.dispatcher.publish(
            "payer.updated",
            {
                "event": "prior_auth_status",
                "order_id": order_id,
                "payer_id": payer_id,
                "auth_number": auth_number,
                "status": status,
                "expires_at": result.expires_at.isoformat(),
            },
        )
        return result

    # ------------------------------------------------------------------
    # Remittance ingestion
    # ------------------------------------------------------------------
    def ingest_remit(
        self,
        *,
        remit_id: str,
        claim_id: str,
        payer_id: str,
        amount_billed: float,
        amount_paid: float,
        order_id: Optional[str] = None,
    ) -> RemitResult:
        processed_at = datetime.now(timezone.utc)
        variance = float(amount_paid) - float(amount_billed)
        status = "paid" if variance >= -0.01 else "underpaid"
        closed_by_claim = self.task_store.close_tasks_by_metadata("claim_id", claim_id)
        tasks_closed = tuple(task.get("id") for task in closed_by_claim)
        payload = RemitResult(
            remit_id=remit_id,
            claim_id=claim_id,
            payer_id=payer_id,
            order_id=order_id,
            amount_billed=float(amount_billed),
            amount_paid=float(amount_paid),
            variance=variance,
            status=status,
            processed_at=processed_at,
            tasks_closed=tasks_closed,
        )
        self._append_remit_record(payload)
        self.dispatcher.publish(
            "payer.updated",
            {
                "event": "remit_ingested",
                "remit_id": remit_id,
                "claim_id": claim_id,
                "payer_id": payer_id,
                "order_id": order_id,
                "status": status,
                "variance": round(variance, 2),
                "tasks_closed": list(tasks_closed),
                "processed_at": processed_at.isoformat(),
            },
        )
        return payload

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------
    def _append_remit_record(self, remit: RemitResult) -> None:
        automation_utils.ensure_directory(self._remit_log.parent)
        line = json.dumps(remit.to_dict())
        with self._remit_log.open("a", encoding="utf-8") as handle:
            handle.write(line + "\n")
