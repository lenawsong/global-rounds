"""Event dispatching utilities for the automation prototype."""
from __future__ import annotations

import asyncio
import json
import threading
from datetime import datetime, timezone
from fnmatch import fnmatchcase
from pathlib import Path
from typing import Callable, Dict, List, Mapping, MutableMapping, Sequence, Tuple

from automation import utils as automation_utils

EVENT_LOG_FILE = "events.jsonl"


class EventDispatcher:
    """Minimal event dispatcher persisting to JSONL for replay/debug."""

    def __init__(self, data_dir: Path) -> None:
        self.data_dir = data_dir
        self.path = self.data_dir / EVENT_LOG_FILE
        self._lock = threading.Lock()
        self._subscribers: MutableMapping[str, List[EventListener]] = {}
        self._pattern_subscribers: MutableMapping[str, List[EventListener]] = {}

    def publish(self, topic: str, payload: Mapping[str, object]) -> Mapping[str, object]:
        event = {
            "topic": topic,
            "payload": dict(payload),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        self._append_to_log(event)
        self._notify(topic, event)
        return event

    def subscribe(self, topic: str, listener: "EventListener") -> None:
        with self._lock:
            normalized = (topic or "*").strip() or "*"
            target = self._pattern_subscribers if self._is_pattern(normalized) else self._subscribers
            target.setdefault(normalized, []).append(listener)

    def unsubscribe(self, topic: str, listener: "EventListener") -> None:
        with self._lock:
            normalized = (topic or "*").strip() or "*"
            target = self._pattern_subscribers if self._is_pattern(normalized) else self._subscribers
            listeners = target.get(normalized)
            if not listeners:
                return
            try:
                listeners.remove(listener)
            except ValueError:
                return
            if not listeners:
                target.pop(normalized, None)

    def subscribe_queue(
        self, topics: Sequence[str], maxsize: int = 100
    ) -> Tuple[Callable[[], None], "asyncio.Queue[Mapping[str, object]]"]:
        """Subscribe to events and receive them via an asyncio queue."""

        queue: "asyncio.Queue[Mapping[str, object]]" = asyncio.Queue(maxsize=maxsize)
        listeners: List[Tuple[str, EventListener]] = []

        for topic in topics:
            normalized = (topic or "*").strip() or "*"

            def _listener(event: Mapping[str, object], *, _queue=queue) -> None:
                try:
                    _queue.put_nowait(dict(event))
                except asyncio.QueueFull:
                    try:
                        _queue.get_nowait()
                    except asyncio.QueueEmpty:
                        pass
                    try:
                        _queue.put_nowait(dict(event))
                    except asyncio.QueueFull:
                        pass

            listeners.append((normalized, _listener))
            self.subscribe(normalized, _listener)

        def _cleanup() -> None:
            for topic, listener in listeners:
                self.unsubscribe(topic, listener)

        return _cleanup, queue

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    def _append_to_log(self, event: Mapping[str, object]) -> None:
        automation_utils.ensure_directory(self.path.parent)
        line = json.dumps(event, default=str)
        with self._lock:
            with self.path.open("a", encoding="utf-8") as handle:
                handle.write(line + "\n")

    def _notify(self, topic: str, event: Mapping[str, object]) -> None:
        listeners = list(self._subscribers.get(topic, []))
        listeners.extend(self._subscribers.get("*", []))
        for pattern, callbacks in self._pattern_subscribers.items():
            if fnmatchcase(topic, pattern):
                listeners.extend(callbacks)
        for listener in listeners:
            try:
                listener(event)
            except Exception:  # pragma: no cover - defensive
                continue

    @staticmethod
    def _is_pattern(topic: str) -> bool:
        return any(char in topic for char in {"*", "?", "["})

EventListener = Callable[[Mapping[str, object]], None]

def load_recent_events(data_dir: Path, limit: int = 50) -> List[Mapping[str, object]]:
    path = data_dir / EVENT_LOG_FILE
    if not path.exists():
        return []
    lines = path.read_text(encoding="utf-8").strip().splitlines()[-limit:]
    events: List[Mapping[str, object]] = []
    for line in lines:
        try:
            events.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return events


def load_events_for_order(data_dir: Path, order_id: str, limit: int | None = None) -> List[Mapping[str, object]]:
    """Return chronological events scoped to a single order."""

    if not order_id:
        return []

    path = data_dir / EVENT_LOG_FILE
    if not path.exists():
        return []

    events: List[Mapping[str, object]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue
        payload = event.get("payload", {})
        if isinstance(payload, Mapping) and payload.get("order_id") == order_id:
            events.append(event)

    events.sort(key=lambda item: item.get("timestamp", ""))
    if limit is not None:
        return events[-limit:]
    return events


def replay_events(
    data_dir: Path,
    *,
    since: datetime | None = None,
    until: datetime | None = None,
    topics: Sequence[str] | None = None,
    order_id: str | None = None,
) -> List[Mapping[str, object]]:
    """Replay events filtered by time range, topics, or order id."""

    path = data_dir / EVENT_LOG_FILE
    if not path.exists():
        return []

    topic_patterns = [str(topic).strip() for topic in topics or [] if str(topic).strip()]

    def _matches(event_topic: str) -> bool:
        if not topic_patterns:
            return True
        return any(pattern == "*" or fnmatchcase(event_topic, pattern) for pattern in topic_patterns)

    def _parse_timestamp(value: str | None) -> datetime | None:
        if not value:
            return None
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None

    events: List[Mapping[str, object]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue
        topic = str(event.get("topic") or "")
        if not topic or not _matches(topic):
            continue
        payload = event.get("payload", {})
        if order_id and (not isinstance(payload, Mapping) or payload.get("order_id") != order_id):
            continue
        timestamp = _parse_timestamp(event.get("timestamp"))
        if since and (not timestamp or timestamp < since):
            continue
        if until and timestamp and timestamp > until:
            continue
        events.append(event)

    events.sort(key=lambda item: item.get("timestamp", ""))
    return events
