"""Revenue impact modeling for Global Rounds automation."""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import List, Mapping

from automation.performance import compute_kpis
from automation.finance import compute_financial_pulse
from automation.workforce import forecast_staffing, SHIFT_HOURS

LABOR_RATE_USD = 28.0
PAYMENT_RECOVERY_MULTIPLIER = 1.0
WORKFORCE_EFFICIENCY_RATE = 0.1


def _parse_float(value: object) -> float:
    if value is None:
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip()
    if not text:
        return 0.0
    cleaned = text.replace('$', '').replace(',', '').replace('%', '')
    try:
        return float(cleaned)
    except ValueError:
        return 0.0


def _extract_latest(records: Mapping[str, object] | None, key: str) -> Mapping[str, object]:
    if not records:
        return {}
    values = records.get(key)
    if isinstance(values, list) and values:
        return values[0] if isinstance(values[0], Mapping) else {}
    return {}


def _to_timezone_aware(as_of: datetime) -> datetime:
    if as_of.tzinfo:
        return as_of.astimezone(timezone.utc)
    return as_of.replace(tzinfo=timezone.utc)


def build_revenue_model(data_dir: Path, as_of: datetime) -> Mapping[str, object]:
    as_of_utc = _to_timezone_aware(as_of)
    as_of_naive = as_of_utc.replace(tzinfo=None)
    performance_kpis = compute_kpis(data_dir, as_of_naive)
    finance_snapshot = compute_financial_pulse(data_dir, as_of_naive)
    workforce_projection = forecast_staffing(data_dir, as_of_naive)

    performance_latest = _extract_latest(performance_kpis, 'latest_snapshot')
    finance_latest = _extract_latest(finance_snapshot, 'latest_snapshot')

    ordering_minutes_saved = _parse_float(performance_latest.get('time_saved_minutes'))
    ordering_monthly_value = (ordering_minutes_saved / 60.0) * LABOR_RATE_USD
    ordering_annual_value = ordering_monthly_value * 12

    payments_cash_recovered = _parse_float(finance_latest.get('projected_cash_recovered'))
    payments_labor_minutes = _parse_float(finance_latest.get('labor_minutes_saved'))
    payments_monthly_value = payments_cash_recovered * PAYMENT_RECOVERY_MULTIPLIER
    payments_monthly_value += (payments_labor_minutes / 60.0) * LABOR_RATE_USD
    payments_annual_value = payments_monthly_value * 12

    staffing_plan = workforce_projection.get('staffing_plan', [])
    projected_hours = sum(_parse_float(item.get('hours_needed')) for item in staffing_plan)
    workforce_monthly_value = projected_hours * WORKFORCE_EFFICIENCY_RATE * LABOR_RATE_USD
    workforce_annual_value = workforce_monthly_value * 12

    modules: List[Mapping[str, object]] = [
        {
            "name": "Ordering Automation",
            "minutes_saved_per_month": round(ordering_minutes_saved, 1),
            "monthly_value_usd": round(ordering_monthly_value, 2),
            "annual_value_usd": round(ordering_annual_value, 2),
        },
        {
            "name": "Payments Recovery",
            "cash_recovered_per_month_usd": round(payments_cash_recovered, 2),
            "minutes_saved_per_month": round(payments_labor_minutes, 1),
            "monthly_value_usd": round(payments_monthly_value, 2),
            "annual_value_usd": round(payments_annual_value, 2),
        },
        {
            "name": "Workforce Optimization",
            "projected_hours_per_4w": round(projected_hours, 1),
            "efficiency_gain_percent": WORKFORCE_EFFICIENCY_RATE * 100,
            "monthly_value_usd": round(workforce_monthly_value, 2),
            "annual_value_usd": round(workforce_annual_value, 2),
        },
    ]

    annual_value = sum(module["annual_value_usd"] for module in modules)
    valuation_multiple = 4.0
    implied_valuation = annual_value * valuation_multiple

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "as_of": as_of_utc.isoformat(),
        "modules": modules,
        "annual_recurring_value_usd": round(annual_value, 2),
        "valuation_multiple": valuation_multiple,
        "implied_valuation_usd": round(implied_valuation, 2),
    }
