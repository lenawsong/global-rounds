"""Lightweight LLM guardrail helpers."""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Mapping, Optional

from pydantic import BaseModel, Field, ValidationError


class ProviderTaskSummary(BaseModel):
    summary: str = Field(..., max_length=280)
    tone: str = Field(default="professional")
    risk_level: str = Field(default="medium")


@dataclass
class GuardedNarrativeClient:
    """Produces deterministic narratives with schema validation."""

    enabled: bool = bool(int(os.getenv("AUTOMATION_LLM_ENABLED", "0")))

    def provider_task_summary(
        self,
        *,
        patient_id: Optional[str],
        supply_sku: Optional[str],
        metadata: Mapping[str, object],
    ) -> Mapping[str, str]:
        candidate = {
            "summary": self._fallback_summary(patient_id, supply_sku, metadata),
            "tone": "professional",
            "risk_level": self._risk_from_metadata(metadata),
        }
        if not self.enabled:
            return ProviderTaskSummary(**candidate).dict()
        try:
            validated = ProviderTaskSummary(**candidate)
        except ValidationError:
            validated = ProviderTaskSummary(**candidate)
        return validated.dict()

    @staticmethod
    def _fallback_summary(
        patient_id: Optional[str],
        supply_sku: Optional[str],
        metadata: Mapping[str, object],
    ) -> str:
        patient = patient_id or "patient"
        sku = supply_sku or "supply"
        gap_type = str(metadata.get("gap_type") or metadata.get("compliance_key") or "compliance review")
        notes = str(metadata.get("notes") or "Pending documentation review.")
        return f"Review {sku} documentation for {patient}: {gap_type}. {notes}"[:280]

    @staticmethod
    def _risk_from_metadata(metadata: Mapping[str, object]) -> str:
        severity = str(metadata.get("severity") or metadata.get("priority") or "medium").lower()
        if severity in {"high", "urgent", "critical"}:
            return "high"
        if severity in {"low"}:
            return "low"
        return "medium"
