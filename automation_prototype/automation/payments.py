"""Payment reconciliation & error detection prototype."""
from __future__ import annotations

from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Iterable, List

from . import utils

UNDERPAYMENT_THRESHOLD = 0.05  # 5%
AGING_BUCKETS = [30, 60, 90]
DENIAL_CODES_REQUIRING_DOCS = {"M27", "CO-16", "CO-197"}


def _bucket_age(days: int) -> str:
    for bucket in AGING_BUCKETS:
        if days <= bucket:
            return f"<={bucket}"
    return f">{AGING_BUCKETS[-1]}"


def reconcile_claims(data_dir: Path, as_of: datetime) -> Dict[str, Iterable[Dict[str, str]]]:
    ledger_rows = utils.load_csv(
        data_dir / "claims_ledger.csv",
        parse_dates=["date_of_service", "billed_date"],
    )
    status_rows = utils.load_csv(data_dir / "payer_status.csv", parse_dates=["status_date"])

    latest_status: Dict[str, Dict[str, object]] = {}
    for row in status_rows:
        claim_id = row["claim_id"]
        existing = latest_status.get(claim_id)
        if not existing or row.get("status_date") > existing.get("status_date"):
            latest_status[claim_id] = row

    alerts: List[Dict[str, str]] = []
    outstanding_summary: Dict[str, float] = {}
    underpayment_cases: List[Dict[str, str]] = []
    documentation_queue: List[Dict[str, str]] = []

    for row in ledger_rows:
        claim_id = row["claim_id"]
        expected = float(row.get("expected_amount", 0) or 0)
        received = float(row.get("received_amount", 0) or 0)
        payer = row.get("payer", "")
        patient_id = row.get("patient_id", "")
        status_info = latest_status.get(claim_id, {})
        status = status_info.get("status") or row.get("status") or "unknown"
        last_update = status_info.get("status_date") or row.get("billed_date")

        if isinstance(last_update, datetime):
            age_days = (as_of - last_update).days
        else:
            age_days = 0

        bucket = _bucket_age(age_days)
        balance = expected - received
        if balance > 0:
            outstanding_summary[bucket] = outstanding_summary.get(bucket, 0.0) + balance

        if expected > 0 and received / expected < (1 - UNDERPAYMENT_THRESHOLD):
            underpayment_cases.append(
                {
                    "claim_id": claim_id,
                    "patient_id": patient_id,
                    "payer": payer,
                    "expected": f"{expected:.2f}",
                    "received": f"{received:.2f}",
                    "variance": f"{expected - received:.2f}",
                    "status": status,
                }
            )

        denial_code = status_info.get("denial_code") or ""
        if denial_code in DENIAL_CODES_REQUIRING_DOCS:
            documentation_queue.append(
                {
                    "claim_id": claim_id,
                    "payer": payer,
                    "denial_code": denial_code,
                    "requested_docs": "Medical records / WOPD",
                    "status": status,
                }
            )

        if balance > 0 and age_days >= AGING_BUCKETS[0]:
            severity = "high" if age_days >= AGING_BUCKETS[2] else "medium"
            alerts.append(
                {
                    "severity": severity,
                    "message": f"Claim {claim_id} aged {age_days} days with balance {balance:.2f}",
                    "patient_id": patient_id,
                    "payer": payer,
                }
            )

    summary_rows = [
        {
            "aging_bucket": bucket,
            "outstanding": f"{amount:.2f}",
        }
        for bucket, amount in sorted(outstanding_summary.items())
    ]

    return {
        "aging_alerts": alerts,
        "underpayments": underpayment_cases,
        "documentation_queue": documentation_queue,
        "outstanding_summary": summary_rows,
    }
