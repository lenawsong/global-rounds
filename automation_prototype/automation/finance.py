"""Financial pulse agent computing ROI metrics."""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Dict, Iterable, Mapping

from . import utils

LABOR_MINUTES_PER_TASK = {
    "compliance_review": 12,
    "compliance_radar": 10,
    "patient_action": 8,
    "finance_review": 15,
}

RECOVERY_PER_UNDERPAYMENT = 120.0  # synthetic assumption
DSO_BASELINE = 45.0


def _load_tasks(data_dir: Path) -> Iterable[Mapping[str, object]]:
    path = data_dir / "tasks.json"
    if not path.exists():
        return []
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []
    return payload.get("tasks", [])


def _minutes_saved(tasks: Iterable[Mapping[str, object]]) -> float:
    total = 0.0
    for task in tasks:
        task_type = str(task.get("task_type", ""))
        minutes = LABOR_MINUTES_PER_TASK.get(task_type, 5)
        total += minutes
    return total


def _projected_recovery(payments: Mapping[str, Iterable[Mapping[str, object]]]) -> float:
    underpayments = payments.get("underpayments", [])
    return len(list(underpayments)) * RECOVERY_PER_UNDERPAYMENT


def compute_financial_pulse(data_dir: Path, as_of: datetime) -> Dict[str, Iterable[Mapping[str, object]]]:
    tasks = list(_load_tasks(data_dir))
    payments_data = {}
    sample_path = data_dir / "dashboard_sample.json"
    if sample_path.exists():
        try:
            payments_data = utils.load_json(sample_path).get("payments", {})
        except Exception:  # pragma: no cover - defensive
            payments_data = {}

    minutes_saved = _minutes_saved(tasks)
    projected_recovery = _projected_recovery(payments_data)
    dso_delta = max(DSO_BASELINE - minutes_saved / 60.0, 0)

    snapshot = {
        "date": as_of.strftime("%Y-%m-%d"),
        "labor_minutes_saved": f"{minutes_saved:.0f}",
        "projected_cash_recovered": f"${projected_recovery:,.0f}",
        "dso": f"{dso_delta:.1f}",
    }

    trend_summary = [
        {"metric": "labor_minutes_saved", "period": "This month", "change": f"{minutes_saved:.0f}"},
        {"metric": "projected_cash_recovered", "period": "This month", "change": f"${projected_recovery:,.0f}"},
        {"metric": "dso", "period": "This month", "change": f"{(DSO_BASELINE - dso_delta):.1f}"},
    ]

    return {
        "latest_snapshot": [snapshot],
        "trend_summary": trend_summary,
    }
