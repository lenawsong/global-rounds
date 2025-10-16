"""Task queue storage and helpers."""
from __future__ import annotations

import json
import threading
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List, Mapping, MutableMapping, Optional, Sequence

from automation import utils as automation_utils

TASK_FILE = "tasks.json"
DEFAULT_SLA_HOURS = 24


def _parse_iso(value: str) -> Optional[datetime]:
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


@dataclass
class Task:
    id: str
    title: str
    task_type: str
    priority: str
    status: str
    owner: Optional[str]
    due_at: Optional[str]
    created_at: str
    updated_at: str
    sla_ref: Optional[str] = None
    breach_reason: Optional[str] = None
    cycle_time_secs: Optional[int] = None
    first_pass_flag: Optional[bool] = None
    metadata: Mapping[str, object] = field(default_factory=dict)

    def to_dict(self) -> Mapping[str, object]:
        payload = {
            "id": self.id,
            "title": self.title,
            "task_type": self.task_type,
            "priority": self.priority,
            "status": self.status,
            "owner": self.owner,
            "due_at": self.due_at,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "sla_ref": self.sla_ref,
            "breach_reason": self.breach_reason,
            "cycle_time_secs": self.cycle_time_secs,
            "first_pass_flag": self.first_pass_flag,
            "metadata": dict(self.metadata),
        }
        return payload


class TaskStore:
    def __init__(self, data_dir: Path) -> None:
        self.data_dir = data_dir
        self.path = self.data_dir / TASK_FILE
        self._lock = threading.Lock()
        self._tasks: MutableMapping[str, Mapping[str, object]] = {}
        self._load()

    # ------------------------------------------------------------------
    # Persistence
    # ------------------------------------------------------------------
    def _load(self) -> None:
        if not self.path.exists():
            self._tasks = {}
            return
        try:
            data = json.loads(self.path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            data = {"tasks": []}
        records = data.get("tasks", []) if isinstance(data, dict) else data
        self._tasks = {record.get("id", self._generate_id()): dict(record) for record in records}

    def _persist(self) -> None:
        automation_utils.ensure_directory(self.path.parent)
        snapshot = {"tasks": list(self._tasks.values())}
        self.path.write_text(json.dumps(snapshot, indent=2), encoding="utf-8")

    # ------------------------------------------------------------------
    # CRUD
    # ------------------------------------------------------------------
    def list_tasks(self, status: Optional[str] = None) -> List[Mapping[str, object]]:
        with self._lock:
            tasks = list(self._tasks.values())
            if status:
                statuses = {value.strip().lower() for value in status.split(",")}
                tasks = [task for task in tasks if str(task.get("status", "")).lower() in statuses]
            tasks.sort(key=lambda item: item.get("created_at", ""), reverse=True)
            return [dict(task) for task in tasks]

    def list_tasks_by_type(
        self,
        task_types: Sequence[str],
        *,
        status: Optional[str] = None,
    ) -> List[Mapping[str, object]]:
        desired = {value.strip().lower() for value in task_types if str(value).strip()}
        if not desired:
            return []
        tasks = self.list_tasks(status=status)
        return [task for task in tasks if str(task.get("task_type", "")).lower() in desired]

    def has_open_task_for_order(self, order_id: str) -> bool:
        with self._lock:
            for task in self._tasks.values():
                metadata = task.get("metadata") or {}
                if metadata.get("order_id") == order_id and str(task.get("status", "")).lower() in {"open", "in_progress"}:
                    return True
        return False

    def close_tasks_for_order(self, order_id: str) -> List[Mapping[str, object]]:
        closed: List[Mapping[str, object]] = []
        with self._lock:
            for task_id, task in list(self._tasks.items()):
                metadata = task.get("metadata") or {}
                if metadata.get("order_id") == order_id and str(task.get("status", "")).lower() in {"open", "in_progress"}:
                    now = datetime.now(timezone.utc)
                    updated = dict(task)
                    updated["status"] = "closed"
                    updated["updated_at"] = now.isoformat()
                    created_dt = _parse_iso(str(updated.get("created_at"))) if updated.get("created_at") else None
                    if created_dt and not updated.get("cycle_time_secs"):
                        updated["cycle_time_secs"] = int((now - created_dt).total_seconds())
                    if updated.get("first_pass_flag") is None:
                        updated["first_pass_flag"] = True
                    self._tasks[task_id] = updated
                    closed.append(dict(updated))
            if closed:
                self._persist()
        return closed

    def close_tasks_by_metadata(self, key: str, value: str) -> List[Mapping[str, object]]:
        closed: List[Mapping[str, object]] = []
        with self._lock:
            for task_id, task in list(self._tasks.items()):
                metadata = task.get("metadata") or {}
                if metadata.get(key) != value:
                    continue
                if str(task.get("status", "")).lower() not in {"open", "in_progress"}:
                    continue
                now = datetime.now(timezone.utc)
                updated = dict(task)
                updated["status"] = "closed"
                updated["updated_at"] = now.isoformat()
                created_dt = _parse_iso(str(updated.get("created_at"))) if updated.get("created_at") else None
                if created_dt and not updated.get("cycle_time_secs"):
                    updated["cycle_time_secs"] = int((now - created_dt).total_seconds())
                if updated.get("first_pass_flag") is None:
                    updated["first_pass_flag"] = True
                self._tasks[task_id] = updated
                closed.append(dict(updated))
            if closed:
                self._persist()
        return closed

    def ensure_sla_task(self, breach: "SlaBreach") -> Optional[Mapping[str, object]]:
        from backend.tasks import ensure_sla_task as _ensure

        return _ensure(self, breach)

    def get_task(self, task_id: str) -> Optional[Mapping[str, object]]:
        with self._lock:
            task = self._tasks.get(task_id)
            return dict(task) if task else None

    def has_open_task_with_key(self, key: str, value: str) -> bool:
        with self._lock:
            for task in self._tasks.values():
                metadata = task.get("metadata") or {}
                if metadata.get(key) == value and str(task.get("status", "")).lower() in {"open", "in_progress"}:
                    return True
        return False

    def create_task(
        self,
        *,
        title: str,
        task_type: str,
        priority: str = "normal",
        owner: Optional[str] = None,
        metadata: Optional[Mapping[str, object]] = None,
        sla_hours: Optional[int] = None,
        sla_ref: Optional[str] = None,
        breach_reason: Optional[str] = None,
        first_pass_flag: Optional[bool] = None,
        cycle_time_secs: Optional[int] = None,
    ) -> Mapping[str, object]:
        now = datetime.now(timezone.utc)
        task_id = self._generate_id()
        due_at = None
        hours = sla_hours if sla_hours is not None else DEFAULT_SLA_HOURS
        if hours:
            due_at = (now + timedelta(hours=hours)).isoformat()
        record = Task(
            id=task_id,
            title=title,
            task_type=task_type,
            priority=priority,
            status="open",
            owner=owner,
            due_at=due_at,
            created_at=now.isoformat(),
            updated_at=now.isoformat(),
            sla_ref=sla_ref,
            breach_reason=breach_reason,
            cycle_time_secs=cycle_time_secs,
            first_pass_flag=first_pass_flag,
            metadata=metadata or {},
        ).to_dict()
        with self._lock:
            self._tasks[task_id] = record
            self._persist()
        return dict(record)

    def update_status(self, task_id: str, status: str, owner: Optional[str] = None) -> Mapping[str, object]:
        with self._lock:
            if task_id not in self._tasks:
                raise KeyError(f"Task {task_id} not found")
            task = dict(self._tasks[task_id])
            previous_status = str(task.get("status", "")).lower()
            task["status"] = status
            if owner is not None:
                task["owner"] = owner
            now = datetime.now(timezone.utc)
            task["updated_at"] = now.isoformat()
            if previous_status != "closed" and str(status).lower() == "closed":
                created_at = task.get("created_at")
                created_dt = _parse_iso(str(created_at)) if created_at else None
                if created_dt:
                    task["cycle_time_secs"] = int((now - created_dt).total_seconds())
                if task.get("first_pass_flag") is None:
                    task["first_pass_flag"] = True
            self._tasks[task_id] = task
            self._persist()
            return dict(task)

    def assign_owner(self, task_id: str, owner: str) -> Mapping[str, object]:
        with self._lock:
            if task_id not in self._tasks:
                raise KeyError(f"Task {task_id} not found")
            task = dict(self._tasks[task_id])
            task["owner"] = owner
            task["updated_at"] = datetime.now(timezone.utc).isoformat()
            self._tasks[task_id] = task
            self._persist()
            return dict(task)

    # ------------------------------------------------------------------
    # Utilities
    # ------------------------------------------------------------------
    @staticmethod
    def _generate_id() -> str:
        return f"TASK-{uuid.uuid4().hex[:8].upper()}"


def ensure_task_for_portal_hold(store: TaskStore, order: Mapping[str, object]) -> Optional[Mapping[str, object]]:
    status = str(order.get("status", "")).lower()
    if status == "approved":
        return None
    order_id = order.get("id")
    if not order_id:
        return None
    if store.has_open_task_for_order(str(order_id)):
        return None
    metadata = {
        "order_id": order_id,
        "patient_id": order.get("patient_id"),
        "supply_sku": order.get("supply_sku"),
        "ai_notes": order.get("ai_notes", []),
    }
    title = f"Review compliance hold for {order.get('patient_id')} / {order.get('supply_sku')}"
    priority = "high" if order.get("priority") in {"urgent", "stat"} else "normal"
    return store.create_task(
        title=title,
        task_type="compliance_review",
        priority=priority,
        metadata=metadata,
        sla_hours=16 if priority == "high" else 36,
    )


def ensure_task_for_compliance_gap(
    store: TaskStore,
    *,
    patient_id: str,
    supply_sku: str,
    gap_type: str,
    severity: str,
    notes: Optional[str] = None,
    target_date: Optional[str] = None,
) -> Optional[Mapping[str, object]]:
    key = f"compliance::{patient_id}::{supply_sku}::{gap_type}"
    if store.has_open_task_with_key("compliance_key", key):
        return None

    metadata = {
        "patient_id": patient_id,
        "supply_sku": supply_sku,
        "gap_type": gap_type,
        "compliance_key": key,
        "notes": notes or "",
        "target_date": target_date,
    }

    sla_hours = 12 if severity == "high" else 24
    task = store.create_task(
        title=f"Resolve {gap_type} for {patient_id} / {supply_sku}",
        task_type="compliance_radar",
        priority="high" if severity == "high" else "normal",
        metadata=metadata,
        sla_hours=sla_hours,
    )

    return task


def create_patient_action_task(
    store: TaskStore,
    *,
    patient_id: str,
    order_id: str,
    action: str,
    notes: Optional[str] = None,
) -> Mapping[str, object]:
    title = f"Patient {action} for order {order_id}"
    metadata = {
        "patient_id": patient_id,
        "order_id": order_id,
        "action": action,
        "notes": notes or "",
    }
    priority = "high" if action in {"needs_help", "reschedule"} else "normal"
    return store.create_task(
        title=title,
        task_type="patient_action",
        priority=priority,
        metadata=metadata,
        sla_hours=12 if priority == "high" else 24,
    )


def ensure_sla_task(store: TaskStore, breach: "SlaBreach") -> Optional[Mapping[str, object]]:
    """Ensure an SLA breach task exists for the provided breach."""
    from backend.sla import SlaBreach as SlaBreachModel

    if not isinstance(breach, SlaBreachModel):
        return None

    sla_key = f"sla::{breach.order_id}::{breach.spec_name}"
    if store.has_open_task_with_key("sla_key", sla_key):
        return None

    metadata = {
        "order_id": breach.order_id,
        "sla_order_id": breach.order_id,
        "sla_key": sla_key,
        "sla_spec": breach.spec_name,
        "metric": breach.metric,
        "observed": breach.observed,
        "threshold": breach.threshold,
        "credits": breach.credits,
        "details": breach.details or "",
    }

    title = f"Investigate SLA breach: {breach.spec_name}"
    reason = breach.details or f"{breach.metric} breached threshold {breach.threshold}"
    metadata["breach_reason"] = reason
    first_pass_flag = False if breach.metric == "first_pass_ratio" else None
    return store.create_task(
        title=title,
        task_type="sla_breach",
        priority="high",
        metadata=metadata,
        sla_hours=12,
        sla_ref=sla_key,
        breach_reason=reason,
        first_pass_flag=first_pass_flag,
    )



def close_sla_tasks(store: TaskStore, order_id: str) -> List[Mapping[str, object]]:
    """Close any SLA breach tasks for a given order."""
    return store.close_tasks_by_metadata("sla_order_id", order_id)
