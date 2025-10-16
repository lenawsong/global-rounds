"""Predictive workforce management prototype."""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Iterable, List

from . import utils

SHIFT_HOURS = 6.5
SURGE_THRESHOLD = 1.2  # 20% above trailing average


def _week_start(date: datetime) -> datetime:
    return date - timedelta(days=date.weekday())


def _format(date: datetime) -> str:
    return date.strftime("%Y-%m-%d")


def forecast_staffing(data_dir: Path, as_of: datetime, horizon_weeks: int = 4) -> Dict[str, Iterable[Dict[str, str]]]:
    pipeline_rows = utils.load_csv(data_dir / "order_pipeline.csv", parse_dates=["date"])
    benchmarks = utils.load_json(data_dir / "task_benchmarks.json")

    horizon_end = as_of + timedelta(weeks=horizon_weeks)

    future_rows = [
        row for row in pipeline_rows
        if isinstance(row.get("date"), datetime)
        and as_of <= row["date"] < horizon_end
    ]

    team_hours: Dict[str, Dict[str, float]] = defaultdict(lambda: defaultdict(float))

    for row in future_rows:
        stage = row.get("stage", "unknown")
        team = row.get("team") or stage
        orders = float(row.get("orders_count", 0) or 0)
        minutes_per_order = float(benchmarks.get(stage, 20))
        hours = (orders * minutes_per_order) / 60.0
        week_key = _format(_week_start(row["date"]))
        team_hours[team][week_key] += hours

    staffing_plan: List[Dict[str, str]] = []
    surge_alerts: List[Dict[str, str]] = []

    historical_rows = [
        row for row in pipeline_rows
        if isinstance(row.get("date"), datetime) and row["date"] < as_of
    ]

    trailing_hours: Dict[str, float] = defaultdict(float)
    trailing_counts: Dict[str, int] = defaultdict(int)

    for row in historical_rows:
        stage = row.get("stage", "unknown")
        team = row.get("team") or stage
        orders = float(row.get("orders_count", 0) or 0)
        minutes_per_order = float(benchmarks.get(stage, 20))
        hours = (orders * minutes_per_order) / 60.0
        trailing_hours[team] += hours
        trailing_counts[team] += 1

    for team, week_hours in team_hours.items():
        avg_hours = trailing_hours[team] / trailing_counts[team] if trailing_counts[team] else 0
        for week_start, hours in sorted(week_hours.items()):
            headcount = hours / SHIFT_HOURS if SHIFT_HOURS else 0
            staffing_plan.append(
                {
                    "team": team,
                    "week_start": week_start,
                    "hours_needed": f"{hours:.1f}",
                    "recommended_headcount": f"{headcount:.1f}",
                }
            )
            if avg_hours and hours >= avg_hours * SURGE_THRESHOLD:
                surge_alerts.append(
                    {
                        "team": team,
                        "week_start": week_start,
                        "hours": f"{hours:.1f}",
                        "baseline_hours": f"{avg_hours:.1f}",
                        "message": "Projected workload surge",
                    }
                )

    return {
        "staffing_plan": staffing_plan,
        "surge_alerts": surge_alerts,
    }
