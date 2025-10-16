"""Utility helpers for the Global Rounds automation prototype."""
from __future__ import annotations

import csv
import json
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, Iterable, List, Mapping, Sequence


DATE_FORMATS = ["%Y-%m-%d", "%m/%d/%Y", "%Y/%m/%d"]


def parse_date(value: str) -> datetime:
    """Parse dates from multiple common formats."""
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(value, fmt)
        except ValueError:
            continue
    raise ValueError(f"Unsupported date format: {value}")


def load_csv(path: Path, parse_dates: Sequence[str] | None = None) -> List[Dict[str, object]]:
    data: List[Dict[str, object]] = []
    with path.open("r", encoding="utf-8") as csvfile:
        reader = csv.DictReader(csvfile)
        for row in reader:
            record: Dict[str, object] = dict(row)
            if parse_dates:
                for column in parse_dates:
                    if column in record and record[column]:
                        record[column] = parse_date(str(record[column]))
            data.append(record)
    return data


def load_json(path: Path) -> Mapping[str, float]:
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


@dataclass
class WorkOrder:
    patient_id: str
    supply_sku: str
    required_date: datetime
    quantity: int
    compliance_status: str
    notes: str

    def to_dict(self) -> Mapping[str, str]:
        return {
            "patient_id": self.patient_id,
            "supply_sku": self.supply_sku,
            "required_date": self.required_date.strftime("%Y-%m-%d"),
            "quantity": self.quantity,
            "compliance_status": self.compliance_status,
            "notes": self.notes,
        }


@dataclass
class Alert:
    severity: str
    message: str
    metadata: Mapping[str, str]

    def to_dict(self) -> Mapping[str, str]:
        payload: Dict[str, str] = {"severity": self.severity, "message": self.message}
        payload.update({str(k): str(v) for k, v in self.metadata.items()})
        return payload


def moving_average(series: Sequence[float], period: int) -> float:
    if period <= 0:
        raise ValueError("period must be positive")
    tail = list(series)[-period:]
    return sum(tail) / len(tail) if tail else 0.0


def rolling_sum(series: Sequence[float], period: int) -> float:
    tail = list(series)[-period:]
    return sum(tail) if tail else 0.0


def ensure_directory(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def export_json(data: Iterable[Mapping[str, object]], destination: Path) -> None:
    ensure_directory(destination.parent)
    payload: List[Mapping[str, object]] = [dict(item) for item in data]
    destination.write_text(json.dumps(payload, indent=2), encoding="utf-8")
