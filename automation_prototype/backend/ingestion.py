"""Task ingestion utilities."""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import List, Mapping, MutableMapping

from backend.events import EventDispatcher
from backend.portal import PortalOrderStore
from backend.tasks import TaskStore, ensure_task_for_portal_hold


def ingest_portal_holds(
    data_dir: Path,
    *,
    dispatcher: EventDispatcher | None = None,
    as_of: datetime | None = None,
) -> Mapping[str, object]:
    """Ensure all non-approved portal orders have compliance review tasks."""

    portal_store = PortalOrderStore(data_dir=data_dir)
    task_store = TaskStore(data_dir=data_dir)
    dispatcher = dispatcher or EventDispatcher(data_dir=data_dir)
    timestamp = (as_of or datetime.now(timezone.utc)).isoformat()

    orders = portal_store.list_orders(status="pending,hold,review")
    created: List[str] = []

    for order in orders:
        task = ensure_task_for_portal_hold(task_store, order)
        if not task:
            continue
        created.append(str(task.get("id")))
        dispatcher.publish(
            "task.created",
            {
                "task_id": task.get("id"),
                "task_type": task.get("task_type"),
                "priority": task.get("priority"),
                "order_id": order.get("id"),
                "generated_at": timestamp,
            },
        )

    summary: MutableMapping[str, object] = {
        "processed_orders": len(orders),
        "tasks_created": len(created),
        "task_ids": created,
        "run_at": timestamp,
    }
    return summary

