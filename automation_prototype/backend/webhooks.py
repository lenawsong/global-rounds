"""Webhook registry and outbox helpers."""
from __future__ import annotations

import asyncio
import json
import logging
import threading
import uuid
from datetime import datetime, timezone
from fnmatch import fnmatchcase
from pathlib import Path
from typing import List, Mapping, MutableMapping, Sequence

from automation import utils as automation_utils

WEBHOOK_FILE = "webhooks.json"
OUTBOX_FILE = "webhook_outbox.jsonl"


class WebhookRegistry:
    """Persisted registry of webhook subscriptions."""

    def __init__(self, data_dir: Path) -> None:
        self.path = data_dir / WEBHOOK_FILE
        self._lock = threading.Lock()
        self._webhooks: MutableMapping[str, Mapping[str, object]] = {}
        self._load()

    # ------------------------------------------------------------------
    # Persistence helpers
    # ------------------------------------------------------------------
    def _load(self) -> None:
        if not self.path.exists():
            self._webhooks = {}
            return
        try:
            raw = json.loads(self.path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            raw = {"webhooks": []}

        records = raw.get("webhooks", []) if isinstance(raw, dict) else raw
        store: MutableMapping[str, Mapping[str, object]] = {}

        for record in records:
            webhook_id = str(record.get("id") or self._generate_id())
            topics = [str(topic).strip() for topic in record.get("topics", []) if str(topic).strip()]
            normalized = {
                "id": webhook_id,
                "url": str(record.get("url") or ""),
                "topics": topics,
                "secret": record.get("secret"),
                "description": record.get("description"),
                "created_at": record.get("created_at")
                or datetime.now(timezone.utc).isoformat(),
            }
            store[webhook_id] = normalized

        self._webhooks = store

    def _persist(self) -> None:
        automation_utils.ensure_directory(self.path.parent)
        payload = {"webhooks": list(self._webhooks.values())}
        self.path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    @staticmethod
    def _generate_id() -> str:
        return f"WH-{uuid.uuid4().hex[:8].upper()}"

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def list(self) -> List[Mapping[str, object]]:
        with self._lock:
            return [dict(record) for record in self._webhooks.values()]

    def add(
        self,
        url: str,
        topics: Sequence[str],
        *,
        secret: str | None = None,
        description: str | None = None,
    ) -> Mapping[str, object]:
        normalized_topics = [str(topic).strip() for topic in topics if str(topic).strip()]
        if not normalized_topics:
            raise ValueError("At least one topic must be provided")

        record = {
            "id": self._generate_id(),
            "url": str(url),
            "topics": normalized_topics,
            "secret": secret,
            "description": description,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        with self._lock:
            self._webhooks[record["id"]] = record
            self._persist()
        return dict(record)

    def remove(self, webhook_id: str) -> bool:
        with self._lock:
            if webhook_id in self._webhooks:
                self._webhooks.pop(webhook_id)
                self._persist()
                return True
        return False

    def match(self, topic: str) -> List[Mapping[str, object]]:
        normalized_topic = str(topic).strip()
        with self._lock:
            matches: List[Mapping[str, object]] = []
            for record in self._webhooks.values():
                topics = [str(item).strip() for item in record.get("topics", []) if str(item).strip()]
                for candidate in topics:
                    if candidate == "*" or normalized_topic == candidate or fnmatchcase(normalized_topic, candidate):
                        matches.append(dict(record))
                        break
            return matches


class WebhookOutbox:
    """Persistent queue of webhook deliveries."""

    def __init__(self, data_dir: Path) -> None:
        self.path = data_dir / OUTBOX_FILE
        self._lock = threading.Lock()

    # ------------------------------------------------------------------
    # Persistence helpers
    # ------------------------------------------------------------------
    def _load_entries(self) -> List[MutableMapping[str, object]]:
        if not self.path.exists():
            return []
        try:
            lines = self.path.read_text(encoding="utf-8").strip().splitlines()
        except OSError:
            return []
        entries: List[MutableMapping[str, object]] = []
        for line in lines:
            if not line:
                continue
            try:
                entries.append(dict(json.loads(line)))
            except json.JSONDecodeError:
                continue
        return entries

    def _write_entries(self, entries: List[Mapping[str, object]]) -> None:
        automation_utils.ensure_directory(self.path.parent)
        if not entries:
            self.path.write_text("", encoding="utf-8")
            return
        serialized = "\n".join(json.dumps(entry, default=str) for entry in entries)
        self.path.write_text(serialized + "\n", encoding="utf-8")

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def enqueue(self, webhook: Mapping[str, object], event: Mapping[str, object]) -> Mapping[str, object]:
        payload = {
            "id": f"DL-{uuid.uuid4().hex[:8].upper()}",
            "webhook_id": webhook.get("id"),
            "url": webhook.get("url"),
            "topic": event.get("topic"),
            "payload": event.get("payload", {}),
            "timestamp": event.get("timestamp"),
            "queued_at": datetime.now(timezone.utc).isoformat(),
            "status": "pending",
            "attempts": 0,
        }

        with self._lock:
            entries = self._load_entries()
            entries.append(payload)
            self._write_entries(entries)
        return payload

    def list_recent(self, limit: int = 50) -> List[Mapping[str, object]]:
        with self._lock:
            entries = self._load_entries()
            if limit:
                entries = entries[-limit:]
            return [dict(entry) for entry in entries]

    def pending_entries(self) -> List[Mapping[str, object]]:
        with self._lock:
            entries = self._load_entries()
            return [dict(entry) for entry in entries if str(entry.get("status", "")).lower() == "pending"]

    def mark_status(
        self,
        delivery_id: str,
        status: str,
        *,
        error: str | None = None,
    ) -> bool:
        with self._lock:
            entries = self._load_entries()
            updated = False
            for entry in entries:
                if entry.get("id") != delivery_id:
                    continue
                entry["status"] = status
                entry["updated_at"] = datetime.now(timezone.utc).isoformat()
                if status == "delivered":
                    entry["delivered_at"] = datetime.now(timezone.utc).isoformat()
                    entry.pop("error", None)
                elif error:
                    entry["error"] = error
                entry["attempts"] = int(entry.get("attempts", 0)) + 1
                updated = True
                break
            if updated:
                self._write_entries(entries)
            return updated


class WebhookDispatcher:
    """Bridge events into the webhook outbox."""

    def __init__(self, registry: WebhookRegistry, outbox: WebhookOutbox) -> None:
        self.registry = registry
        self.outbox = outbox

    def handle_event(self, event: Mapping[str, object]) -> None:
        topic = str(event.get("topic") or "").strip()
        if not topic:
            return
        matches = self.registry.match(topic)
        if not matches:
            return
        for webhook in matches:
            self.outbox.enqueue(webhook, event)


class WebhookDeliveryWorker:
    """Background worker that delivers pending webhook payloads."""

    def __init__(
        self,
        outbox: WebhookOutbox,
        *,
        interval_seconds: float = 5.0,
    ) -> None:
        self.outbox = outbox
        self.interval_seconds = interval_seconds
        self._task: asyncio.Task | None = None
        self._running = False
        self._logger = logging.getLogger(__name__)

    def start(self) -> None:
        if self._task is not None:
            return
        self._running = True
        loop = asyncio.get_running_loop()
        self._task = loop.create_task(self._run())

    async def stop(self) -> None:
        self._running = False
        if self._task is None:
            return
        self._task.cancel()
        try:
            await self._task
        except asyncio.CancelledError:
            pass
        self._task = None

    async def _run(self) -> None:
        while self._running:
            pending = self.outbox.pending_entries()
            for entry in pending:
                await self._process_entry(entry)
            await asyncio.sleep(self.interval_seconds)

    async def _process_entry(self, entry: Mapping[str, object]) -> None:
        delivery_id = str(entry.get("id"))
        if not delivery_id:
            return
        # Placeholder delivery: mark as delivered to avoid duplicate processing.
        self._logger.info(
            "webhook delivery simulated id=%s topic=%s url=%s",
            delivery_id,
            entry.get("topic"),
            entry.get("url"),
        )
        self.outbox.mark_status(delivery_id, "delivered")
