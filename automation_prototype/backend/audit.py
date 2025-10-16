"""Audit vault helpers built on top of the event ledger."""
from __future__ import annotations

import base64
import json
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Iterable, List, Mapping, Optional

from backend.events import load_events_for_order, replay_events

ATTACHMENT_FILE = "audit_attachments.json"


def _ensure_bytes(payload: bytes | str) -> bytes:
    if isinstance(payload, bytes):
        return payload
    return str(payload).encode("utf-8")


@dataclass
class AuditTimeline:
    order_id: str
    generated_at: datetime
    events: List[Mapping[str, object]]
    attachments: List[Mapping[str, object]]

    def to_dict(self) -> Mapping[str, object]:
        return {
            "order_id": self.order_id,
            "generated_at": self.generated_at.isoformat(),
            "events": self.events,
            "attachments": self.attachments,
        }


@dataclass
class AttachmentRecord:
    attachment_id: str
    order_id: str
    name: str
    content_type: str
    checksum: str
    size_bytes: int
    stored_at: datetime
    metadata: Mapping[str, object]
    content_b64: str

    def to_dict(self) -> Mapping[str, object]:
        return {
            "attachment_id": self.attachment_id,
            "order_id": self.order_id,
            "name": self.name,
            "content_type": self.content_type,
            "checksum": self.checksum,
            "size_bytes": self.size_bytes,
            "stored_at": self.stored_at.isoformat(),
            "metadata": dict(self.metadata),
            "content_b64": self.content_b64,
        }


class AuditVault:
    """Lightweight audit timeline builder using the append-only event log."""

    def __init__(self, data_dir: Path) -> None:
        self.data_dir = Path(data_dir)
        self._attachment_path = self.data_dir / ATTACHMENT_FILE
        self._attachments = self._load_attachments()

    def timeline(self, order_id: str) -> AuditTimeline:
        events = load_events_for_order(self.data_dir, order_id)
        return AuditTimeline(
            order_id=order_id,
            generated_at=datetime.now(timezone.utc),
            events=events,
            attachments=self.list_attachments(order_id),
        )

    def replay(
        self,
        *,
        since: Optional[datetime] = None,
        until: Optional[datetime] = None,
        topics: Optional[Iterable[str]] = None,
        order_id: Optional[str] = None,
    ) -> AuditTimeline:
        events = replay_events(
            self.data_dir,
            since=since,
            until=until,
            topics=list(topics) if topics else None,
            order_id=order_id,
        )
        identifier = order_id or "stream"
        return AuditTimeline(
            order_id=str(identifier),
            generated_at=datetime.now(timezone.utc),
            events=events,
            attachments=self.list_attachments(order_id) if order_id else [],
        )

    def export(self, order_id: str, destination: Path) -> Path:
        timeline = self.timeline(order_id)
        destination = Path(destination)
        destination.write_text(json.dumps(timeline.to_dict(), indent=2), encoding="utf-8")
        return destination

    # ------------------------------------------------------------------
    # Attachment helpers
    # ------------------------------------------------------------------
    def add_attachment(
        self,
        order_id: str,
        *,
        name: str,
        content: bytes | str,
        content_type: str = "application/octet-stream",
        metadata: Optional[Mapping[str, object]] = None,
    ) -> Mapping[str, object]:
        payload = _ensure_bytes(content)
        checksum = self._sha256(payload)
        record = AttachmentRecord(
            attachment_id=f"AUD-{uuid.uuid4().hex[:10].upper()}",
            order_id=order_id,
            name=name,
            content_type=content_type,
            checksum=checksum,
            size_bytes=len(payload),
            stored_at=datetime.now(timezone.utc),
            metadata=metadata or {},
            content_b64=base64.b64encode(payload).decode("ascii"),
        )
        bucket = self._attachments.setdefault(order_id, [])
        bucket.append(record.to_dict())
        self._persist_attachments()
        return record.to_dict()

    def list_attachments(self, order_id: Optional[str]) -> List[Mapping[str, object]]:
        if not order_id:
            return []
        records = self._attachments.get(order_id, [])
        return [dict(entry) for entry in records]

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------
    def _load_attachments(self) -> Dict[str, List[Mapping[str, object]]]:
        if not self._attachment_path.exists():
            return {}
        try:
            payload = json.loads(self._attachment_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return {}
        if isinstance(payload, dict):
            return {
                str(order_id): [dict(record) for record in records]
                for order_id, records in payload.get("attachments", {}).items()
            }
        return {}

    def _persist_attachments(self) -> None:
        snapshot = {"attachments": self._attachments}
        self._attachment_path.write_text(json.dumps(snapshot, indent=2), encoding="utf-8")

    @staticmethod
    def _sha256(payload: bytes) -> str:
        import hashlib

        digest = hashlib.sha256()
        digest.update(payload)
        return digest.hexdigest()
