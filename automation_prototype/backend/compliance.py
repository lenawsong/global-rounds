"""Compliance radar scanning service."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, List, Mapping

from automation import utils

from backend.events import EventDispatcher
from backend.tasks import TaskStore, ensure_task_for_compliance_gap

LOOKAHEAD_DAYS = 7


def _normalize_datetime(value: object | None) -> datetime | None:
    if not value:
        return None
    if isinstance(value, datetime):
        return value.replace(tzinfo=timezone.utc)
    try:
        return utils.parse_date(str(value)).replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def scan_compliance(
    data_dir: Path,
    *,
    as_of: datetime,
    task_store: TaskStore,
    dispatcher: EventDispatcher,
) -> Mapping[str, object]:
    rows = utils.load_csv(data_dir / "compliance_status.csv", parse_dates=["next_due_date"])
    threshold = as_of + timedelta(days=LOOKAHEAD_DAYS)

    alerts: List[Mapping[str, object]] = []
    tasks_created = []

    for row in rows:
        patient_id = row.get("patient_id")
        supply_sku = row.get("supply_sku")
        if not patient_id or not supply_sku:
            continue

        due_date = _normalize_datetime(row.get("next_due_date"))
        severity = "normal"
        gaps: List[str] = []

        if row.get("f2f_status") != "current":
            gaps.append("F2F expired")
            severity = "high"
        if row.get("wopd_status") != "on_file":
            gaps.append("WOPD missing")
            severity = "high"
        prior_auth = row.get("prior_auth_status")
        if prior_auth not in {"approved", "not_required"}:
            gaps.append("Prior auth pending")

        if due_date and due_date <= threshold:
            gaps.append("Compliance due soon")
            if due_date <= as_of:
                severity = "high"

        if not gaps:
            continue

        note = "; ".join(gaps)
        alert = {
            "patient_id": patient_id,
            "supply_sku": supply_sku,
            "due_date": due_date.isoformat() if due_date else None,
            "severity": severity,
            "notes": note,
        }
        alerts.append(alert)

        task = ensure_task_for_compliance_gap(
            task_store,
            patient_id=str(patient_id),
            supply_sku=str(supply_sku),
            gap_type="compliance_gap",
            severity=severity,
            notes=note,
            target_date=due_date.isoformat() if due_date else None,
        )
        if task:
            tasks_created.append(task)
            dispatcher.publish(
                "compliance.alert",
                {
                    "task_id": task.get("id"),
                    "patient_id": patient_id,
                    "supply_sku": supply_sku,
                    "severity": severity,
                },
            )

    summary: Dict[str, object] = {
        "alerts": alerts,
        "tasks_created": [task.get("id") for task in tasks_created],
        "total_alerts": len(alerts),
        "total_tasks_created": len(tasks_created),
        "run_at": datetime.now(timezone.utc).isoformat(),
    }
    return summary
