"""Service level agreement evaluation and automation helpers."""
from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterable, List, Mapping, MutableMapping, Optional, Sequence, Tuple

from pydantic import BaseModel, Field, ValidationError

from backend.events import load_events_for_order
from backend.tasks import TaskStore

POLICY_FILE = "sla_policy.json"
DEFAULT_POLICY_VERSION = "2024-Q4"


class CreditRule(BaseModel):
    """Defines how credits are calculated for SLA results."""

    currency: str = Field(default="USD")
    per_breach: float = Field(default=0.0, ge=0)
    bonus_per_hit: float = Field(default=0.0, ge=0)
    notes: Optional[str] = None


class SlaSpec(BaseModel):
    """Declarative SLA definition."""

    name: str
    metric: str
    threshold: float | int | str
    window: str
    credit_rule: CreditRule


class SlaBreach(BaseModel):
    """Represents an SLA breach for a specific order."""

    spec_name: str
    metric: str
    order_id: str
    observed: Optional[float | int | str]
    threshold: float | int | str
    occurred_at: datetime
    credits: float = 0.0
    details: Optional[str] = None


class SlaMetricScore(BaseModel):
    """Score detail for a single SLA metric."""

    spec_name: str
    metric: str
    passed: bool
    observed: Optional[float | int | str]
    threshold: float | int | str
    window: str
    credits: float = 0.0
    notes: Optional[str] = None


class SlaScore(BaseModel):
    """Aggregate SLA score for one order."""

    order_id: str
    evaluated_at: datetime
    policy_version: str
    metrics: List[SlaMetricScore]
    breaches: List[SlaBreach]
    total_credits: float
    volume_tier: str


class CreditMemo(BaseModel):
    """Credit memo generated when an SLA breach occurs."""

    order_id: str
    spec_name: str
    amount: float
    currency: str
    issued_at: datetime
    reason: str


@dataclass
class _PolicyBundle:
    version: str
    specs: List[SlaSpec]


DEFAULT_SPECS: Tuple[SlaSpec, ...] = (
    SlaSpec(
        name="72h Delivery",
        metric="delivery_time_hours",
        threshold=72.0,
        window="order.approved -> shipment.delivered",
        credit_rule=CreditRule(per_breach=150.0, bonus_per_hit=5.0, notes="Credit if delivery exceeds 72h."),
    ),
    SlaSpec(
        name="First-Pass Approvals",
        metric="first_pass_ratio",
        threshold=0.98,
        window="order.created -> order.approved",
        credit_rule=CreditRule(per_breach=75.0, bonus_per_hit=2.5, notes="Targeting ≥98% first pass approvals."),
    ),
    SlaSpec(
        name="Zero Compliance Lapses",
        metric="compliance_lapses",
        threshold=0,
        window="order lifecycle",
        credit_rule=CreditRule(per_breach=100.0, notes="No compliance lapses allowed."),
    ),
    SlaSpec(
        name="DSO ≤28d",
        metric="dso_days",
        threshold=28.0,
        window="shipment.delivered -> claim.paid",
        credit_rule=CreditRule(per_breach=200.0, bonus_per_hit=10.0, notes="Maintain cash velocity."),
    ),
    SlaSpec(
        name="Audit Ready",
        metric="audit_readiness",
        threshold=1.0,
        window="order.created -> audit.vaulted",
        credit_rule=CreditRule(per_breach=120.0, notes="Every order must be audit-ready."),
    ),
    SlaSpec(
        name="Live Status",
        metric="status_latency_hours",
        threshold=1.0,
        window="most recent status update",
        credit_rule=CreditRule(per_breach=50.0, notes="Surface live order status updates."),
    ),
)


def load_policy(data_dir: Path | None = None) -> _PolicyBundle:
    """Load SLA policy from disk or fall back to defaults."""

    version = DEFAULT_POLICY_VERSION
    specs: Sequence[SlaSpec] = DEFAULT_SPECS

    if data_dir is not None:
        policy_path = Path(data_dir) / POLICY_FILE
        if policy_path.exists():
            try:
                raw = json.loads(policy_path.read_text(encoding="utf-8"))
                if isinstance(raw, Mapping):
                    version = str(raw.get("version", version))
                    raw_specs = raw.get("specs", [])
                else:
                    raw_specs = raw
                specs = [SlaSpec.parse_obj(entry) for entry in raw_specs]
            except (json.JSONDecodeError, ValidationError):
                specs = DEFAULT_SPECS
                version = DEFAULT_POLICY_VERSION

    return _PolicyBundle(version=version, specs=list(specs))


def _to_datetime(value: Any) -> Optional[datetime]:
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(value, tz=timezone.utc)
    text = str(value)
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None


def _filter_events(events: Iterable[Mapping[str, Any]], topics: Sequence[str]) -> List[Mapping[str, Any]]:
    desired = {topic.lower() for topic in topics}
    filtered = [event for event in events if str(event.get("topic", "")).lower() in desired]
    return filtered


def _first_event_timestamp(events: Iterable[Mapping[str, Any]], topics: Sequence[str]) -> Optional[datetime]:
    filtered = _filter_events(events, topics)
    timestamps = [_to_datetime(event.get("timestamp")) for event in filtered]
    timestamps = [stamp for stamp in timestamps if stamp]
    return min(timestamps) if timestamps else None


def _last_event_timestamp(events: Iterable[Mapping[str, Any]], topics: Sequence[str]) -> Optional[datetime]:
    filtered = _filter_events(events, topics)
    timestamps = [_to_datetime(event.get("timestamp")) for event in filtered]
    timestamps = [stamp for stamp in timestamps if stamp]
    return max(timestamps) if timestamps else None


def _extract_first_pass(events: Iterable[Mapping[str, Any]]) -> float:
    for event in events:
        if str(event.get("topic", "")).lower() == "order.first_pass":
            payload = event.get("payload", {})
            success = bool(payload.get("success", True))
            return 1.0 if success else 0.0
    for event in events:
        if str(event.get("topic", "")).lower() == "task.created":
            payload = event.get("payload", {})
            if payload.get("task_type") in {"compliance_review", "sla_breach", "rework"}:
                return 0.0
    return 1.0


def _compute_delivery_hours(events: Sequence[Mapping[str, Any]]) -> Optional[float]:
    start = _first_event_timestamp(events, ["order.approved", "order.created"])
    delivered = _first_event_timestamp(events, ["shipment.delivered", "order.fulfilled"])
    if not start or not delivered:
        return None
    return (delivered - start).total_seconds() / 3600.0


def _compute_dso_days(events: Sequence[Mapping[str, Any]]) -> Optional[float]:
    fulfilled = _first_event_timestamp(events, ["shipment.delivered", "order.fulfilled"])
    paid = _first_event_timestamp(events, ["claim.paid", "order.paid"])
    if not fulfilled or not paid:
        return None
    return (paid - fulfilled).days + (paid - fulfilled).seconds / 86400.0


def _has_compliance_lapse(events: Sequence[Mapping[str, Any]]) -> bool:
    for event in events:
        topic = str(event.get("topic", "")).lower()
        if topic in {"order.lapsed", "compliance.lapsed", "audit.failed"}:
            return True
    return False


def _is_audit_ready(events: Sequence[Mapping[str, Any]]) -> bool:
    for event in events:
        topic = str(event.get("topic", "")).lower()
        if topic in {"audit.ready", "audit.vaulted", "audit.package_generated"}:
            return True
    return False


def _status_latency_hours(events: Sequence[Mapping[str, Any]], evaluated_at: datetime) -> Optional[float]:
    latest = _last_event_timestamp(events, [
        "order.status",
        "status.live",
        "shipment.delivered",
        "order.updated",
        "tracking.updated",
    ])
    if not latest:
        latest = _last_event_timestamp(events, [event.get("topic", "") for event in events])
    if not latest:
        return None
    delta = evaluated_at - latest
    return max(delta.total_seconds() / 3600.0, 0.0)


def determine_volume_tier(passed: int, total: int) -> str:
    if total <= 0:
        return "unknown"
    ratio = passed / total
    if ratio >= 1.0:
        return "platinum"
    if ratio >= 0.9:
        return "gold"
    if ratio >= 0.75:
        return "silver"
    if ratio >= 0.5:
        return "bronze"
    return "standard"


def evaluate(
    order_events: Sequence[Mapping[str, Any]],
    *,
    policy: Optional[Sequence[SlaSpec]] = None,
    policy_version: str | None = None,
    evaluated_at: Optional[datetime] = None,
) -> SlaScore:
    """Evaluate an order timeline against SLA policy."""

    if not order_events:
        raise ValueError("No order events provided for SLA evaluation.")

    evaluated_at = evaluated_at or datetime.now(timezone.utc)
    policy_bundle = _PolicyBundle(
        version=policy_version or DEFAULT_POLICY_VERSION,
        specs=list(policy or DEFAULT_SPECS),
    )

    order_id = ""
    normalized_events = []
    for event in order_events:
        candidate = dict(event)
        payload = candidate.get("payload", {})
        if isinstance(payload, Mapping) and not order_id:
            order_id = str(payload.get("order_id", ""))
        normalized_events.append(candidate)
    if not order_id:
        order_id = str(order_events[0].get("payload", {}).get("order_id", "UNKNOWN"))

    metric_results: List[SlaMetricScore] = []
    breaches: List[SlaBreach] = []
    total_credits = 0.0

    for spec in policy_bundle.specs:
        observed: Optional[float | int | str]
        passed = True
        notes: Optional[str] = None

        if spec.metric == "delivery_time_hours":
            observed = _compute_delivery_hours(normalized_events)
            if observed is None:
                passed = False
                notes = "Missing delivery confirmation event."
            else:
                passed = observed <= float(spec.threshold)
        elif spec.metric == "first_pass_ratio":
            value = _extract_first_pass(normalized_events)
            observed = round(value, 3)
            passed = observed >= float(spec.threshold)
        elif spec.metric == "compliance_lapses":
            observed = 1 if _has_compliance_lapse(normalized_events) else 0
            passed = observed <= int(spec.threshold)
        elif spec.metric == "dso_days":
            dso = _compute_dso_days(normalized_events)
            observed = None if dso is None else round(dso, 2)
            if observed is None:
                passed = False
                notes = "Missing payment event to calculate DSO."
            else:
                passed = observed <= float(spec.threshold)
        elif spec.metric == "audit_readiness":
            observed = 1.0 if _is_audit_ready(normalized_events) else 0.0
            passed = observed >= float(spec.threshold)
        elif spec.metric == "status_latency_hours":
            latency = _status_latency_hours(normalized_events, evaluated_at)
            observed = None if latency is None else round(latency, 2)
            if observed is None:
                passed = False
                notes = "No live status updates captured."
            else:
                passed = observed <= float(spec.threshold)
        else:
            observed = None
            passed = True
            notes = f"Metric '{spec.metric}' not evaluated (missing handler)."

        credit_amount = spec.credit_rule.per_breach if not passed else 0.0

        if not passed:
            breach = SlaBreach(
                spec_name=spec.name,
                metric=spec.metric,
                order_id=order_id,
                observed=observed,
                threshold=spec.threshold,
                occurred_at=evaluated_at,
                credits=credit_amount,
                details=notes,
            )
            breaches.append(breach)
            total_credits += credit_amount

        metric_notes = notes
        if passed and spec.credit_rule.bonus_per_hit > 0:
            bonus_note = f"Volume bonus eligible: {spec.credit_rule.bonus_per_hit:.2f}"
            metric_notes = f"{notes} {bonus_note}".strip() if notes else bonus_note

        metric_results.append(
            SlaMetricScore(
                spec_name=spec.name,
                metric=spec.metric,
                passed=passed,
                observed=observed,
                threshold=spec.threshold,
                window=spec.window,
                credits=credit_amount,
                notes=metric_notes,
            ),
        )

    passed_count = sum(1 for metric in metric_results if metric.passed)
    volume_tier = determine_volume_tier(passed_count, len(metric_results))

    score = SlaScore(
        order_id=order_id,
        evaluated_at=evaluated_at,
        policy_version=policy_bundle.version,
        metrics=metric_results,
        breaches=breaches,
        total_credits=round(total_credits, 2),
        volume_tier=volume_tier,
    )
    return score


def credit(breach: SlaBreach) -> CreditMemo:
    """Generate a credit memo from a breach."""

    return CreditMemo(
        order_id=breach.order_id,
        spec_name=breach.spec_name,
        amount=float(breach.credits),
        currency="USD",
        issued_at=breach.occurred_at,
        reason=breach.details or f"SLA breach on metric {breach.metric}",
    )


class SlaService:
    """Realtime SLA evaluation service tied to the event dispatcher."""

    def __init__(
        self,
        *,
        data_dir: Path,
        dispatcher,
        task_store: TaskStore,
        auto_subscribe: bool = True,
    ) -> None:
        self.data_dir = Path(data_dir)
        self.dispatcher = dispatcher
        self.task_store = task_store
        bundle = load_policy(self.data_dir)
        self.policy_version = bundle.version
        self.policy = bundle.specs
        if auto_subscribe:
            dispatcher.subscribe("*", self._handle_event)

    def reload_policy(self) -> None:
        bundle = load_policy(self.data_dir)
        self.policy_version = bundle.version
        self.policy = bundle.specs

    def score(self, order_id: str, *, emit: bool = False) -> Optional[SlaScore]:
        events = load_events_for_order(self.data_dir, order_id)
        if not events:
            return None
        score = evaluate(
            events,
            policy=self.policy,
            policy_version=self.policy_version,
        )
        if emit:
            self._emit(score)
        return score

    def _handle_event(self, event: Mapping[str, Any]) -> None:
        topic = str(event.get("topic", ""))
        if topic.startswith("sla."):
            return
        payload = event.get("payload", {}) or {}
        order_id = payload.get("order_id")
        if not order_id:
            return
        self.score(str(order_id), emit=True)

    def _emit(self, score: SlaScore) -> None:
        payload = score.dict()
        self.dispatcher.publish("sla.updated", payload)
        self._sync_tasks(score)

    def _sync_tasks(self, score: SlaScore) -> None:
        from backend.tasks import close_sla_tasks

        if score.breaches:
            for breach in score.breaches:
                self.task_store.ensure_sla_task(breach)
        else:
            close_sla_tasks(self.task_store, score.order_id)

    def get_policy_snapshot(self) -> Mapping[str, Any]:
        return {
            "version": self.policy_version,
            "specs": [spec.dict() for spec in self.policy],
        }
