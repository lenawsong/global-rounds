"""Performance tracking prototype."""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, Iterable, List, Mapping

from . import utils

WINDOW_DAYS = 30
ALERT_THRESHOLDS = {
    "denial_rate": 0.02,
    "first_pass_rate": -0.03,  # drop of 3 percentage points
    "dso": 5,
    "delivery_sla": -0.05,
}

AUTO_APPROVAL_MINUTES = 12
REVIEW_ASSIST_MINUTES = 5
PORTAL_DATA_FILE = "portal_orders.json"


def _pct(value: float) -> str:
    return f"{value * 100:.1f}%"


def _mean(records: List[Dict[str, float]], key: str) -> float:
    if not records:
        return 0.0
    return sum(float(record.get(key, 0) or 0) for record in records) / len(records)


def compute_kpis(data_dir: Path, as_of: datetime) -> Dict[str, Iterable[Dict[str, str]]]:
    rows = utils.load_csv(data_dir / "operational_metrics.csv", parse_dates=["date"])
    rows = [row for row in rows if isinstance(row.get("date"), datetime) and row["date"] <= as_of]
    rows.sort(key=lambda r: r["date"])

    if not rows:
        return {"latest_snapshot": [], "alerts": [], "trend_summary": []}

    latest = rows[-1]
    snapshot = {
        "date": latest["date"].strftime("%Y-%m-%d"),
        "denial_rate": _pct(float(latest.get("denial_rate", 0))),
        "first_pass_rate": _pct(float(latest.get("first_pass_rate", 0))),
        "dso": f"{float(latest.get('dso', 0)):.1f}",
        "delivery_sla": _pct(float(latest.get("delivery_sla", 0))),
        "resupply_cadence": f"{float(latest.get('resupply_cadence', 0)):.1f}",
    }

    cutoff_recent = as_of - timedelta(days=WINDOW_DAYS)
    recent_window = [row for row in rows if row["date"] >= cutoff_recent]
    baseline_window = [row for row in rows if row["date"] < cutoff_recent]

    alerts: List[Dict[str, str]] = []
    if recent_window and baseline_window:
        for metric, threshold in ALERT_THRESHOLDS.items():
            recent_mean = _mean(recent_window, metric)
            baseline_mean = _mean(baseline_window, metric)
            delta = recent_mean - baseline_mean
            if metric in {"denial_rate", "dso"} and delta >= threshold:
                alerts.append(
                    {
                        "metric": metric,
                        "delta": _pct(delta) if "rate" in metric else f"{delta:.1f}",
                        "message": f"{metric} worsening by {delta:.4f}",
                    }
                )
            if metric in {"first_pass_rate", "delivery_sla"} and delta <= threshold:
                alerts.append(
                    {
                        "metric": metric,
                        "delta": _pct(delta),
                        "message": f"{metric} declining by {delta:.4f}",
                    }
                )

    trend_summary: List[Dict[str, str]] = []
    for metric in ["denial_rate", "first_pass_rate", "dso", "delivery_sla"]:
        tail = rows[-8:]
        if len(tail) < 2:
            continue
        first = float(tail[0].get(metric, 0) or 0)
        last = float(tail[-1].get(metric, 0) or 0)
        change = last - first
        period = f"{tail[0]['date'].strftime('%Y-%m-%d')} to {tail[-1]['date'].strftime('%Y-%m-%d')}"
        trend_summary.append(
            {
                "metric": metric,
                "period": period,
                "change": _pct(change) if "rate" in metric else f"{change:.1f}",
            }
        )

    _apply_time_savings(snapshot, data_dir)
    _apply_task_metrics(snapshot, data_dir, as_of)

    return {
        "latest_snapshot": [snapshot],
        "alerts": alerts,
        "trend_summary": trend_summary,
    }


def _apply_time_savings(snapshot: Dict[str, str], data_dir: Path) -> None:
    portal_orders = _load_portal_orders(data_dir)
    if not portal_orders:
        snapshot["time_saved_minutes"] = "0"
        snapshot["time_saved_hours"] = "0.0"
        return

    auto_approved = sum(
        1
        for order in portal_orders
        if (order.get("source") == "portal" and str(order.get("status")).lower() == "approved")
    )
    holds = sum(
        1
        for order in portal_orders
        if (order.get("source") == "portal" and str(order.get("status")).lower() != "approved")
    )

    minutes_saved = auto_approved * AUTO_APPROVAL_MINUTES + holds * REVIEW_ASSIST_MINUTES
    snapshot["time_saved_minutes"] = f"{minutes_saved:.0f}"
    snapshot["time_saved_hours"] = f"{minutes_saved / 60:.1f}"


def _load_portal_orders(data_dir: Path) -> List[Mapping[str, object]]:
    path = data_dir / PORTAL_DATA_FILE
    if not path.exists():
        return []
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []
    orders = payload.get("orders", []) if isinstance(payload, dict) else payload
    return [order for order in orders if order.get("source") == "portal"]


def _load_tasks(data_dir: Path) -> List[Mapping[str, object]]:
    path = data_dir / "tasks.json"
    if not path.exists():
        return []
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []
    tasks = payload.get("tasks", []) if isinstance(payload, dict) else payload
    return tasks


def _parse_datetime(value: object | None) -> datetime | None:
    if not value:
        return None
    if isinstance(value, datetime):
        return value.replace(tzinfo=None)
    try:
        dt = datetime.fromisoformat(str(value))
        if dt.tzinfo:
            return dt.astimezone(timezone.utc).replace(tzinfo=None)
        return dt
    except ValueError:
        return None


def _apply_task_metrics(snapshot: Dict[str, str], data_dir: Path, as_of: datetime) -> None:
    tasks = _load_tasks(data_dir)
    if not tasks:
        snapshot["open_tasks"] = "0"
        snapshot["tasks_at_risk"] = "0"
        snapshot["tasks_closed_today"] = "0"
        return

    open_statuses = {"open", "in_progress"}
    horizon = as_of + timedelta(hours=6)
    open_count = 0
    risk_count = 0
    closed_today = 0

    for task in tasks:
        status = str(task.get("status", "")).lower()
        due_at = _parse_datetime(task.get("due_at"))
        updated = _parse_datetime(task.get("updated_at"))

        if status in open_statuses:
            open_count += 1
            if due_at and due_at <= horizon:
                risk_count += 1

        if status == "closed" and updated and updated.date() == as_of.date():
            closed_today += 1

    snapshot["open_tasks"] = str(open_count)
    snapshot["tasks_at_risk"] = str(risk_count)
    snapshot["tasks_closed_today"] = str(closed_today)
