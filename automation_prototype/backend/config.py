"""Infrastructure configuration helpers."""
from __future__ import annotations

import json
import os
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Mapping


@dataclass
class DatabaseConfig:
    url: str
    migration_table: str


@dataclass
class EventBrokerConfig:
    provider: str
    url: str


@dataclass
class TaskWorkerConfig:
    provider: str
    concurrency: int


@dataclass
class InfrastructureConfig:
    database: DatabaseConfig
    event_broker: EventBrokerConfig
    task_worker: TaskWorkerConfig

    def to_dict(self) -> Mapping[str, object]:
        return asdict(self)


DEFAULT_CONFIG_PATH = Path(__file__).resolve().parents[1] / "config" / "infrastructure.json"


def _load_file_payload(path: Path) -> Mapping[str, object]:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def load_infrastructure_config(path: Path | None = None) -> InfrastructureConfig:
    """Load infrastructure choices with environment overrides."""

    config_path = path or DEFAULT_CONFIG_PATH
    payload = _load_file_payload(config_path)

    database_payload = payload.get("database", {}) if isinstance(payload, dict) else {}
    event_payload = payload.get("event_broker", {}) if isinstance(payload, dict) else {}
    worker_payload = payload.get("task_worker", {}) if isinstance(payload, dict) else {}

    db_url = os.getenv("AUTOMATION_DB_URL") or database_payload.get("url") or "postgresql+asyncpg://automation:automation@localhost:5432/automation"
    migration_table = database_payload.get("migration_table") or os.getenv("AUTOMATION_DB_MIGRATION_TABLE", "schema_history")

    broker_provider = os.getenv("AUTOMATION_EVENT_PROVIDER") or event_payload.get("provider") or "redis"
    broker_url = os.getenv("AUTOMATION_EVENT_URL") or event_payload.get("url") or "redis://localhost:6379/0"

    worker_provider = os.getenv("AUTOMATION_WORKER_PROVIDER") or worker_payload.get("provider") or "dramatiq"
    worker_concurrency = int(os.getenv("AUTOMATION_WORKER_CONCURRENCY") or worker_payload.get("concurrency") or 4)

    database = DatabaseConfig(url=db_url, migration_table=migration_table)
    broker = EventBrokerConfig(provider=str(broker_provider), url=str(broker_url))
    worker = TaskWorkerConfig(provider=str(worker_provider), concurrency=int(worker_concurrency))

    return InfrastructureConfig(database=database, event_broker=broker, task_worker=worker)

