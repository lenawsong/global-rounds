"""Predictive inventory forecasting utilities."""
from __future__ import annotations

import json
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Iterable, List, Mapping, Optional, Sequence

from . import utils

SMOOTHING_ALPHA = 0.6
DEFAULT_LEAD_TIME_DAYS = 14
DEFAULT_DAYS = 30


@dataclass
class InventoryForecast:
    supply_sku: str
    forecast_units: float
    recommended_buffer: float

    def to_dict(self) -> Mapping[str, float | str]:
        return {
            "supply_sku": self.supply_sku,
            "forecast_units": round(self.forecast_units, 2),
            "recommended_buffer": round(self.recommended_buffer, 2),
        }


def _exponential_smoothing(series: Iterable[float], alpha: float) -> float:
    forecast = 0.0
    initialized = False
    for value in series:
        if not initialized:
            forecast = value
            initialized = True
        else:
            forecast = alpha * value + (1 - alpha) * forecast
    return forecast


def forecast_inventory(
    data_dir: Path,
    as_of: datetime,
    *,
    growth_adjustment: float = 0.0,
    lead_time_days: int = DEFAULT_LEAD_TIME_DAYS,
) -> Dict[str, Mapping[str, float | str]]:
    if as_of.tzinfo:
        as_of = as_of.astimezone(timezone.utc).replace(tzinfo=None)
    usage_rows = utils.load_csv(data_dir / "patient_usage.csv")
    inventory_rows = utils.load_csv(data_dir / "inventory_levels.csv")
    portal_path = data_dir / "portal_orders.json"
    try:
        portal_rows = json.loads(portal_path.read_text(encoding='utf-8')).get('orders', []) if portal_path.exists() else []
    except json.JSONDecodeError:
        portal_rows = []

    usage_by_sku: Dict[str, List[float]] = defaultdict(list)
    inventory_index: Dict[str, Mapping[str, object]] = {}
    for record in inventory_rows:
        sku = str(record.get("supply_sku") or "").strip()
        if not sku:
            continue
        inventory_index[sku] = record
    for row in usage_rows:
        sku = row.get("supply_sku")
        daily_use = row.get("avg_daily_use")
        if not sku:
            continue
        try:
            usage_by_sku[str(sku)].append(float(daily_use or 0))
        except ValueError:
            usage_by_sku[str(sku)].append(0.0)

    for row in portal_rows:
        sku = row.get("supply_sku")
        quantity = row.get("quantity")
        created_at = row.get("created_at")
        if not sku:
            continue
        created = None
        if created_at:
            try:
                created = datetime.fromisoformat(created_at)
                if created.tzinfo:
                    created = created.astimezone(timezone.utc).replace(tzinfo=None)
            except ValueError:
                created = None
        if created and (as_of - created).days <= DEFAULT_DAYS:
            try:
                usage_by_sku[str(sku)].append(float(quantity or 0) / DEFAULT_DAYS)
            except ValueError:
                usage_by_sku[str(sku)].append(0.0)

    forecasts: Dict[str, Mapping[str, float | str]] = {}
    for sku, series in usage_by_sku.items():
        smoothed = _exponential_smoothing(series, SMOOTHING_ALPHA)
        adjusted = smoothed * (1 + growth_adjustment)
        inventory_meta = inventory_index.get(sku, {})
        try:
            sku_lead_time = int(inventory_meta.get("lead_time_days", lead_time_days) or lead_time_days)
        except (TypeError, ValueError):
            sku_lead_time = lead_time_days
        horizon_demand = adjusted * (DEFAULT_DAYS + sku_lead_time)
        buffer = max(horizon_demand * 0.15, 5)
        try:
            on_hand = float(inventory_meta.get("on_hand_units", 0) or 0)
        except (TypeError, ValueError):
            on_hand = 0.0
        try:
            reorder_point = float(inventory_meta.get("reorder_point_units", 0) or 0)
        except (TypeError, ValueError):
            reorder_point = 0.0
        if on_hand < horizon_demand:
            action = "reorder"
        elif on_hand < reorder_point:
            action = "watch"
        else:
            action = "buffer_ok"
        vendor = inventory_meta.get("vendor") or ""
        forecasts[sku] = InventoryForecast(
            supply_sku=sku,
            forecast_units=horizon_demand,
            recommended_buffer=buffer,
        ).to_dict() | {
            "on_hand": round(on_hand, 2),
            "reorder_point": round(reorder_point, 2),
            "lead_time_days": sku_lead_time,
            "vendor": str(vendor),
            "action": action,
        }

    return forecasts


def _select_skus(
    data: Mapping[str, Mapping[str, float | str]],
    skus: Optional[Sequence[str]] = None,
) -> Dict[str, Mapping[str, float | str]]:
    if not skus:
        return dict(data)
    desired = {str(sku).strip() for sku in skus if str(sku).strip()}
    if not desired:
        return dict(data)
    return {sku: detail for sku, detail in data.items() if sku in desired}


def _compute_delta(
    baseline: Mapping[str, Mapping[str, float | str]],
    scenario: Mapping[str, Mapping[str, float | str]],
) -> Dict[str, Mapping[str, float]]:
    deltas: Dict[str, Dict[str, float]] = {}
    for sku, scenario_entry in scenario.items():
        base_entry = baseline.get(sku, {})
        entry_delta: Dict[str, float] = {}
        for field_name in {
            "forecast_units",
            "recommended_buffer",
            "on_hand",
            "reorder_point",
        }:
            base_value = float(base_entry.get(field_name) or 0)
            scenario_value = float(scenario_entry.get(field_name) or 0)
            entry_delta[field_name] = round(scenario_value - base_value, 2)
        deltas[sku] = entry_delta
    return deltas


def run_inventory_scenario(
    data_dir: Path,
    as_of: datetime,
    *,
    growth_percent: float = 0.0,
    lead_time_delta: int = 0,
    skus: Optional[Sequence[str]] = None,
) -> Mapping[str, object]:
    """Compare baseline inventory forecast to a scenario with adjusted levers."""

    baseline = forecast_inventory(
        data_dir,
        as_of,
        growth_adjustment=0.0,
        lead_time_days=DEFAULT_LEAD_TIME_DAYS,
    )

    adjusted_lead_time = max(DEFAULT_LEAD_TIME_DAYS + int(lead_time_delta), 1)
    scenario = forecast_inventory(
        data_dir,
        as_of,
        growth_adjustment=growth_percent / 100.0,
        lead_time_days=adjusted_lead_time,
    )

    filtered_baseline = _select_skus(baseline, skus)
    filtered_scenario = _select_skus(scenario, skus)
    deltas = _compute_delta(filtered_baseline, filtered_scenario)

    generated_at = datetime.now(timezone.utc)
    return {
        "generated_at": generated_at,
        "growth_percent": round(growth_percent, 2),
        "lead_time_delta": int(lead_time_delta),
        "lead_time_applied": adjusted_lead_time,
        "skus": list(filtered_scenario.keys()),
        "baseline": filtered_baseline,
        "scenario": filtered_scenario,
        "deltas": deltas,
    }
