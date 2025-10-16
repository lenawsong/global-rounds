"""Utility helpers for patient deep-link tokens."""
from __future__ import annotations

import json
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, List, Mapping

from automation import utils as automation_utils

TOKEN_FILE = "patient_links.json"


class PatientLinkStore:
    def __init__(self, data_dir: Path) -> None:
        self.path = data_dir / TOKEN_FILE
        self._load()

    def _load(self) -> None:
        if self.path.exists():
            try:
                raw = json.loads(self.path.read_text(encoding='utf-8'))
            except json.JSONDecodeError:
                raw = {"links": []}
        else:
            raw = {"links": []}
        self._links: List[Mapping[str, object]] = raw.get("links", [])

    def _persist(self) -> None:
        automation_utils.ensure_directory(self.path.parent)
        payload = {"links": self._links}
        self.path.write_text(json.dumps(payload, indent=2), encoding='utf-8')

    def create_link(self, patient_id: str, order_id: str, expires_minutes: int = 60) -> Mapping[str, object]:
        token = secrets.token_urlsafe(24)
        now = datetime.now(timezone.utc)
        record: Dict[str, object] = {
            "token": token,
            "patient_id": patient_id,
            "order_id": order_id,
            "created_at": now.isoformat(),
            "expires_at": (now + timedelta(minutes=expires_minutes)).isoformat(),
        }
        self._links.append(record)
        self._persist()
        return record

    def validate(self, token: str) -> Mapping[str, object] | None:
        now = datetime.now(timezone.utc)
        for record in self._links:
            if record.get("token") != token:
                continue
            expires_at = record.get("expires_at")
            if expires_at:
                try:
                    expiry = datetime.fromisoformat(expires_at)
                except ValueError:
                    expiry = None
                if expiry and expiry.tzinfo:
                    expiry = expiry.astimezone(timezone.utc)
                if expiry and expiry < now:
                    return None
            return record
        return None
