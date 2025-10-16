"""FastAPI application exposing the automation agents."""
from __future__ import annotations

import sys
import asyncio
import json
import logging
import os
import base64
import binascii
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Mapping, Sequence

import httpx
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

# Ensure automation package is discoverable when running from /backend
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))

from backend.agents import AgentOrchestrator  # noqa: E402
from backend.compliance import scan_compliance  # noqa: E402
from backend.config import load_infrastructure_config  # noqa: E402
from backend.audit import AuditVault  # noqa: E402
from backend.events import EventDispatcher, load_recent_events  # noqa: E402
from backend.patient_links import PatientLinkStore  # noqa: E402
from backend.partners import PartnerOrderStore  # noqa: E402
from backend.payers import PayerConnector  # noqa: E402
from backend.portal import PortalOrderStore, assess_order  # noqa: E402
from backend.provider import create_esign_stub, render_f2f_template, render_wopd_template  # noqa: E402
from backend.tasks import TaskStore, ensure_task_for_portal_hold, create_patient_action_task  # noqa: E402
from backend.ingestion import ingest_portal_holds  # noqa: E402
from backend.llm import GuardedNarrativeClient  # noqa: E402
from backend.reporting import generate_compliance_pdf  # noqa: E402
from backend.webhooks import (  # noqa: E402
    WebhookDispatcher,
    WebhookOutbox,
    WebhookRegistry,
    WebhookDeliveryWorker,
)
from automation.predictive_inventory import (  # noqa: E402
    forecast_inventory,
    run_inventory_scenario,
)
from backend.schemas import (  # noqa: E402
    AgentRunRequest,
    AgentRunResponse,
    AgentStatusResponse,
    EventListResponse,
    ComplianceScanResponse,
    ComplianceReportRequest,
    PortalOrderCreateRequest,
    PortalOrderListResponse,
    PortalOrderResponse,
    TaskListResponse,
    TaskResponse,
    TaskStatusUpdateRequest,
    TaskIngestionResponse,
    TaskAcknowledgeRequest,
    ProviderFormResponse,
    PatientLinkCreateRequest,
    PatientLinkResponse,
    PatientLinkSessionResponse,
    InventoryScenarioRequest,
    InventoryScenarioResponse,
    PayerEligibilityRequest,
    PayerEligibilityResponse,
    PayerPriorAuthRequest,
    PayerPriorAuthResponse,
    PayerRemitRequest,
    PayerRemitResponse,
    PartnerOrderCreateRequest,
    PartnerOrderListResponse,
    PartnerOrderResponse,
    PartnerOrderStatusRequest,
    PartnerUsageResponse,
    AuditAttachmentRequest,
    AuditAttachmentResponse,
    AuditTimelineResponse,
    WebhookCreateRequest,
    WebhookListResponse,
    WebhookOutboxListResponse,
    WebhookResponse,
    ProviderCoPilotResponse,
    ProviderTaskEntry,
    ProviderTaskGuardrail,
    ProviderTaskCompleteRequest,
    ProviderTaskCompleteResponse,
    ProviderESignRequest,
    ProviderESignResponse,
    DashboardChatRequest,
    DashboardChatResponse,
    DashboardChatMessage,
    SlaEvaluateRequest,
    SlaScoreResponse,
    SlaPolicyResponse,
)
from backend.sla import SlaService  # noqa: E402

DASHBOARD_STATIC_DIR = ROOT / "dashboard"
PORTAL_STATIC_DIR = ROOT / "portal"
PATIENT_STATIC_DIR = PORTAL_STATIC_DIR / "patient"
DEFAULT_DATA_DIR = ROOT / "data"
CLAUDE_API_URL = os.getenv("ANTHROPIC_API_URL", "https://api.anthropic.com/v1/messages")
CLAUDE_API_KEY = os.getenv("ANTHROPIC_API_KEY")
DEFAULT_CHAT_MODEL = os.getenv("DASHBOARD_LLM_MODEL", "claude-opus-4-1-20250805")
CLAUDE_CHAT_TIMEOUT = float(os.getenv("ANTHROPIC_TIMEOUT_SECONDS", "60"))
CLAUDE_MAX_OUTPUT_TOKENS = int(os.getenv("DASHBOARD_LLM_MAX_TOKENS", "1024"))
CLAUDE_API_VERSION = os.getenv("ANTHROPIC_API_VERSION", "2023-06-01")
CONTEXT_TOP_N = int(os.getenv("DASHBOARD_CONTEXT_TOP_N", "3"))
ASK_DASHBOARD_SYSTEM_PROMPT = (
    "You are Ask the Dashboard, an assistant that answers operational, financial, and engagement "
    "questions about the Global Rounds Command Center. Use only the provided context and politely "
    "note when information is missing. Focus on concrete numbers, statuses, and recommended actions."
)

app = FastAPI(title="Global Rounds Automation API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if DASHBOARD_STATIC_DIR.exists():
    app.mount(
        "/dashboard",
        StaticFiles(directory=DASHBOARD_STATIC_DIR, html=True),
        name="dashboard",
    )

if PORTAL_STATIC_DIR.exists():
    app.mount(
        "/portal",
        StaticFiles(directory=PORTAL_STATIC_DIR, html=True),
        name="portal",
    )

if PATIENT_STATIC_DIR.exists():
    app.mount(
        "/patient",
        StaticFiles(directory=PATIENT_STATIC_DIR, html=True),
        name="patient",
    )

if DEFAULT_DATA_DIR.exists():
    app.mount("/data", StaticFiles(directory=DEFAULT_DATA_DIR), name="data")

orchestrator = AgentOrchestrator(data_dir=DEFAULT_DATA_DIR)
portal_store = PortalOrderStore(data_dir=DEFAULT_DATA_DIR)
task_store = TaskStore(data_dir=DEFAULT_DATA_DIR)
event_dispatcher = EventDispatcher(data_dir=DEFAULT_DATA_DIR)
sla_service = SlaService(data_dir=DEFAULT_DATA_DIR, dispatcher=event_dispatcher, task_store=task_store)
audit_vault = AuditVault(data_dir=DEFAULT_DATA_DIR)
patient_link_store = PatientLinkStore(data_dir=DEFAULT_DATA_DIR)
partner_order_store = PartnerOrderStore(data_dir=DEFAULT_DATA_DIR)
webhook_registry = WebhookRegistry(data_dir=DEFAULT_DATA_DIR)
webhook_outbox = WebhookOutbox(data_dir=DEFAULT_DATA_DIR)
webhook_dispatcher = WebhookDispatcher(webhook_registry, webhook_outbox)
event_dispatcher.subscribe("*", webhook_dispatcher.handle_event)
webhook_worker = WebhookDeliveryWorker(webhook_outbox)
llm_client = GuardedNarrativeClient()
infrastructure_config = load_infrastructure_config()
payer_connector = PayerConnector(
    data_dir=DEFAULT_DATA_DIR,
    dispatcher=event_dispatcher,
    task_store=task_store,
)
logger = logging.getLogger(__name__)
_compliance_task: asyncio.Task | None = None
COMPLIANCE_SCAN_INTERVAL_SECONDS = 15 * 60


@app.get("/", include_in_schema=False)
async def root_redirect() -> RedirectResponse:
    """Redirect the root path to the operator dashboard."""
    return RedirectResponse(url="/dashboard/")


def _load_sample_dashboard() -> Mapping[str, Any]:
    sample_path = DEFAULT_DATA_DIR / "dashboard_sample.json"
    if not sample_path.exists():
        return {}
    try:
        return json.loads(sample_path.read_text())
    except Exception as exc:  # pragma: no cover - defensive guardrail
        logger.warning("Unable to load dashboard sample context: %s", exc)
        return {}


def _ensure_sequence(value: Any) -> List[Any]:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, tuple):
        return list(value)
    if isinstance(value, Mapping):
        return list(value.values())
    return [value]


def _trim_items(items: Sequence[Any], limit: int | None = None) -> List[Any]:
    count = limit if limit is not None else CONTEXT_TOP_N
    if count <= 0:
        return []
    return list(items)[:count]


def _format_counter(counter: Counter[str]) -> str:
    if not counter:
        return "none"
    parts = []
    for key, value in counter.most_common():
        label = str(key).replace("_", " ")
        parts.append(f"{value} {label}")
    return ", ".join(parts)


def _short_date(value: Any) -> str:
    if value in (None, ""):
        return "unscheduled"
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, str):
        candidate = value.strip()
        if not candidate:
            return "unscheduled"
        try:
            parsed = datetime.fromisoformat(candidate.replace("Z", "+00:00"))
            return parsed.date().isoformat()
        except ValueError:
            return candidate[:10]
    return str(value)


def _to_float(value: Any) -> float:
    if value in (None, ""):
        return 0.0
    try:
        text = str(value).replace("$", "").replace(",", "")
        return float(text)
    except (TypeError, ValueError):
        return 0.0


def _normalize_inventory(entries: Any) -> List[Mapping[str, Any]]:
    if isinstance(entries, Mapping):
        normalized: List[Mapping[str, Any]] = []
        for sku, detail in entries.items():
            if isinstance(detail, Mapping):
                merged = dict(detail)
                merged.setdefault("supply_sku", sku)
                normalized.append(merged)
            else:
                normalized.append({"supply_sku": sku, "detail": detail})
        return normalized
    return _ensure_sequence(entries)


def _append_section(buffer: List[str], title: str, bullet_lines: Sequence[str]) -> None:
    clean = [line.strip() for line in bullet_lines if isinstance(line, str) and line.strip()]
    if not clean:
        return
    buffer.append(f"{title}:")
    for line in clean:
        buffer.append(f"- {line}")
    buffer.append("")


def _build_dashboard_context(context: Mapping[str, Any] | None) -> str:
    payload = context or {}
    snapshot: Mapping[str, Any] | None = None
    data_candidate = payload.get("data") if isinstance(payload.get("data"), Mapping) else None
    if isinstance(data_candidate, Mapping):
        snapshot = data_candidate
    else:
        snapshot = orchestrator.snapshot()
    if not snapshot:
        snapshot = _load_sample_dashboard()

    tasks_data = payload.get("tasks")
    if not isinstance(tasks_data, list):
        try:
            tasks_data = task_store.list_tasks()
        except Exception:  # pragma: no cover - defensive
            tasks_data = []

    inventory_context = payload.get("inventory_forecast")
    if inventory_context is None:
        inventory_context = snapshot.get("inventory_forecast")

    agent_activity = payload.get("agent_activity")
    if not isinstance(agent_activity, list):
        agent_activity = []

    metadata = payload.get("metadata") if isinstance(payload.get("metadata"), Mapping) else {}
    data_mode = payload.get("data_mode") or metadata.get("data_mode")
    as_of = metadata.get("as_of") or payload.get("as_of")

    sections: List[str] = []

    ordering = snapshot.get("ordering") if isinstance(snapshot, Mapping) else {}
    ordering_lines: List[str] = []
    if isinstance(ordering, Mapping):
        work_orders = _ensure_sequence(ordering.get("patient_work_orders"))
        if work_orders:
            status_counts = Counter(str(row.get("compliance_status") or "unknown").lower() for row in work_orders)
            ordering_lines.append(
                f"{len(work_orders)} patient work orders • compliance mix: {_format_counter(status_counts)}."
            )
            for row in _trim_items(work_orders):
                ordering_lines.append(
                    f"{row.get('patient_id', 'Unknown patient')} / {row.get('supply_sku', 'sku')} • qty {row.get('quantity', '—')} "
                    f"due {row.get('required_date', '—')} • status {row.get('compliance_status', 'unknown')}"
                )
        vendor_reorders = _ensure_sequence(ordering.get("vendor_reorders"))
        if vendor_reorders:
            ordering_lines.append(f"{len(vendor_reorders)} vendor reorder suggestions ready.")
            for vendor in _trim_items(vendor_reorders):
                ordering_lines.append(
                    f"{vendor.get('supply_sku', 'Unknown SKU')}: order {vendor.get('suggested_order_qty', '—')} • "
                    f"{vendor.get('rationale', 'no rationale')}"
                )
        alerts = _ensure_sequence(ordering.get("compliance_alerts"))
        if alerts:
            severity_counts = Counter(str(alert.get("severity") or "info").lower() for alert in alerts)
            ordering_lines.append(
                f"{len(alerts)} compliance alerts ({_format_counter(severity_counts)})."
            )
            for alert in _trim_items(alerts):
                ordering_lines.append(
                    f"{str(alert.get('severity') or 'info').title()}: {alert.get('message') or alert.get('notes') or 'needs review'}"
                )

    inventory_lines: List[str] = []
    inventory_entries = _normalize_inventory(inventory_context)
    if inventory_entries:
        action_counts = Counter(str(entry.get("action") or "watch").lower() for entry in inventory_entries)
        inventory_lines.append(
            f"Inventory forecast actions: {_format_counter(action_counts)}."
        )
        for entry in _trim_items(inventory_entries):
            action = str(entry.get("action") or "watch").replace("_", " ")
            sku = entry.get("supply_sku") or entry.get("sku") or "Unknown SKU"
            on_hand = entry.get("on_hand")
            forecast_units = entry.get("forecast_units")
            parts = [f"{sku}: {action}"]
            if on_hand not in (None, ""):
                parts.append(f"on hand {on_hand}")
            if forecast_units not in (None, ""):
                parts.append(f"forecast {forecast_units}")
            inventory_lines.append(
                ", ".join(parts)
            )

    _append_section(sections, "Ordering & Inventory", ordering_lines + inventory_lines)

    payments = snapshot.get("payments") if isinstance(snapshot, Mapping) else {}
    payments_lines: List[str] = []
    if isinstance(payments, Mapping):
        underpayments = _ensure_sequence(payments.get("underpayments"))
        if underpayments:
            payments_lines.append(f"{len(underpayments)} underpayments flagged for follow-up.")
            sorted_underpayments = sorted(underpayments, key=lambda row: _to_float(row.get("variance")), reverse=True)
            for row in _trim_items(sorted_underpayments):
                payments_lines.append(
                    f"Claim {row.get('claim_id', 'unknown')} • {row.get('payer', 'payer')} • variance ${_to_float(row.get('variance')):,.2f} • status {row.get('status', 'pending')}"
                )
        documentation = _ensure_sequence(payments.get("documentation_queue"))
        if documentation:
            payments_lines.append(f"{len(documentation)} claims waiting on documentation.")
            for item in _trim_items(documentation):
                payments_lines.append(
                    f"Claim {item.get('claim_id', 'unknown')} • denial {item.get('denial_code', 'n/a')} • requested {item.get('requested_docs', 'documentation')}"
                )
        aging = _ensure_sequence(payments.get("aging_alerts"))
        if aging:
            payments_lines.append(f"{len(aging)} aging balance alerts active.")
        outstanding = _ensure_sequence(payments.get("outstanding_summary"))
        if outstanding:
            buckets = [
                f"{bucket.get('aging_bucket', 'bucket')}: ${_to_float(bucket.get('outstanding')):,.0f}"
                for bucket in _trim_items(outstanding, limit=len(outstanding))
            ]
            if buckets:
                payments_lines.append("Outstanding AR by bucket — " + ", ".join(buckets))

    _append_section(sections, "Payments", payments_lines)

    workforce = snapshot.get("workforce") if isinstance(snapshot, Mapping) else {}
    workforce_lines: List[str] = []
    if isinstance(workforce, Mapping):
        staffing_plan = _ensure_sequence(workforce.get("staffing_plan"))
        if staffing_plan:
            workforce_lines.append(f"{len(staffing_plan)} staffing plan entries across teams.")
            sorted_plan = sorted(staffing_plan, key=lambda row: _to_float(row.get("hours_needed")), reverse=True)
            for row in _trim_items(sorted_plan):
                workforce_lines.append(
                    f"{row.get('team', 'team')} week {row.get('week_start', '—')}: {row.get('hours_needed', '—')} hours needed (recommended headcount {row.get('recommended_headcount', '—')})"
                )
        surge_alerts = _ensure_sequence(workforce.get("surge_alerts"))
        if surge_alerts:
            workforce_lines.append(f"{len(surge_alerts)} surge alerts forecasted.")
            for alert in _trim_items(surge_alerts):
                workforce_lines.append(
                    f"{alert.get('team', 'team')} week {alert.get('week_start', '—')}: {alert.get('message', 'surge')} (hours {alert.get('hours', '—')} vs baseline {alert.get('baseline_hours', '—')})"
                )

    _append_section(sections, "Workforce", workforce_lines)

    engagement = snapshot.get("engagement") if isinstance(snapshot, Mapping) else {}
    engagement_lines: List[str] = []
    if isinstance(engagement, Mapping):
        patient_msgs = _ensure_sequence(engagement.get("patient_messages"))
        if patient_msgs:
            channel_counts = Counter(str(msg.get("channel") or "unknown").lower() for msg in patient_msgs)
            engagement_lines.append(
                f"{len(patient_msgs)} patient messages queued ({_format_counter(channel_counts)})."
            )
            for msg in _trim_items(patient_msgs):
                engagement_lines.append(
                    f"Patient {msg.get('patient_id', 'id')} via {msg.get('channel', 'channel')} • template {msg.get('template', 'unknown')}"
                )
        case_mgr_msgs = _ensure_sequence(engagement.get("case_manager_messages"))
        if case_mgr_msgs:
            engagement_lines.append(f"{len(case_mgr_msgs)} case manager escalations prepared.")
            for msg in _trim_items(case_mgr_msgs):
                engagement_lines.append(
                    f"{msg.get('patient_id', 'id')} • {msg.get('summary', msg.get('message', 'follow-up needed'))}"
                )

    _append_section(sections, "Engagement", engagement_lines)

    performance = snapshot.get("performance") if isinstance(snapshot, Mapping) else {}
    performance_lines: List[str] = []
    if isinstance(performance, Mapping):
        latest_snapshot = _ensure_sequence(performance.get("latest_snapshot"))
        if latest_snapshot:
            latest = latest_snapshot[0]
            if isinstance(latest, Mapping):
                metrics = []
                for key, label in (
                    ("denial_rate", "Denial rate"),
                    ("first_pass_rate", "First pass"),
                    ("dso", "DSO"),
                    ("delivery_sla", "Delivery SLA"),
                    ("resupply_cadence", "Resupply cadence"),
                ):
                    value = latest.get(key)
                    if value not in (None, ""):
                        metrics.append(f"{label} {value}")
                if metrics:
                    performance_lines.append(
                        f"Latest snapshot {latest.get('date', 'recent')}: " + ", ".join(metrics)
                    )
        trends = _ensure_sequence(performance.get("trend_summary"))
        if trends:
            details = []
            for trend in _trim_items(trends):
                metric = trend.get("metric", "metric")
                change = trend.get("change", "?")
                period = trend.get("period", "period")
                details.append(f"{metric} {change} over {period}")
            if details:
                performance_lines.append("Trends: " + ", ".join(details))

    _append_section(sections, "Performance", performance_lines)

    tasks_list = tasks_data if isinstance(tasks_data, list) else []
    task_lines: List[str] = []
    if tasks_list:
        status_counts = Counter(str(task.get("status") or "unknown").lower() for task in tasks_list)
        priority_counts = Counter(str(task.get("priority") or "unknown").lower() for task in tasks_list)
        task_lines.append(
            f"{len(tasks_list)} tasks tracked • status: {_format_counter(status_counts)} • priority: {_format_counter(priority_counts)}."
        )
        high_priority = [task for task in tasks_list if str(task.get("priority") or "").lower() == "high"]
        spotlight = high_priority or tasks_list
        for task in _trim_items(spotlight):
            task_lines.append(
                f"{task.get('id', 'task')}: {task.get('title', 'no title')} • {task.get('status', 'status')} • due {_short_date(task.get('due_at'))}"
            )

    _append_section(sections, "Tasks", task_lines)

    activity_lines: List[str] = []
    if agent_activity:
        activity_lines.append(f"{len(agent_activity)} recent agent activities captured.")
        for entry in _trim_items(agent_activity):
            activity_lines.append(
                f"{entry.get('title', 'Agent run')} • {entry.get('message', '')} • {entry.get('timestamp', '')}"
            )

    _append_section(sections, "Agent Activity", activity_lines)

    meta_lines: List[str] = []
    if data_mode:
        meta_lines.append(f"Data mode: {data_mode}.")
    if as_of:
        meta_lines.append(f"Last updated around {as_of}.")

    _append_section(sections, "Context", meta_lines)

    return "\n".join(line for line in sections).strip()


def _extract_latest_user_prompt(messages: Sequence[Mapping[str, str]]) -> str:
    for entry in reversed(messages):
        if str(entry.get("role")) == "user":
            content = (entry.get("content") or "").strip()
            if content:
                return content
    return ""


def _build_offline_dashboard_answer(messages: Sequence[Mapping[str, str]]) -> str:
    question = _extract_latest_user_prompt(messages)
    context_text = _build_dashboard_context({})
    heading = (
        "LLM service is not configured. Providing a direct automation snapshot from the latest data."
    )
    if question:
        heading = f"{heading}\n\nPrompt: {question}"
    if context_text:
        return f"{heading}\n\n{context_text}"
    return (
        f"{heading}\n\nNo dashboard data is available yet. Run `python cli.py run-all` and refresh the dashboard."
    )


async def _call_claude_chat(messages: Sequence[Mapping[str, str]], model: str) -> tuple[str, str]:
    if not CLAUDE_API_KEY:
        logger.warning("LLM bridge disabled – returning fallback dashboard summary.")
        return _build_offline_dashboard_answer(messages), "offline-fallback"

    system_segments: List[str] = []
    conversation: List[Mapping[str, object]] = []
    for entry in messages:
        role = entry.get("role")
        content = (entry.get("content") or "").strip()
        if not content:
            continue
        if role == "system":
            system_segments.append(content)
            continue
        mapped_role = "assistant" if role == "assistant" else "user"
        conversation.append(
            {
                "role": mapped_role,
                "content": [
                    {
                        "type": "text",
                        "text": content,
                    }
                ],
            }
        )

    if not any(message["role"] == "user" for message in conversation):
        logger.error("Claude chat request missing user message: %s", messages)
        raise HTTPException(status_code=400, detail="At least one user message is required.")

    payload: Dict[str, object] = {
        "model": model,
        "messages": conversation,
        "max_tokens": CLAUDE_MAX_OUTPUT_TOKENS,
    }
    if system_segments:
        payload = {**payload, "system": "\n\n".join(system_segments)}

    headers = {
        "x-api-key": CLAUDE_API_KEY,
        "content-type": "application/json",
        "anthropic-version": CLAUDE_API_VERSION,
    }

    try:
        async with httpx.AsyncClient(timeout=CLAUDE_CHAT_TIMEOUT) as client:
            response = await client.post(CLAUDE_API_URL, json=payload, headers=headers)
            response.raise_for_status()
    except httpx.HTTPError as exc:
        logger.exception("Claude chat request failed: %s", exc)
        raise HTTPException(status_code=502, detail="LLM service is unavailable.") from exc

    try:
        data = response.json()
    except ValueError as exc:
        logger.exception("Invalid JSON from Claude: %s", exc)
        raise HTTPException(status_code=502, detail="LLM response could not be parsed.") from exc

    content_blocks = data.get("content") or []
    text_segments: List[str] = []
    for block in content_blocks:
        if isinstance(block, dict):
            text_segments.append(block.get("text", ""))
    combined_content = "\n\n".join(segment.strip() for segment in text_segments if segment.strip())
    if not combined_content:
        logger.error("Claude response missing content: %s", data)
        raise HTTPException(status_code=502, detail="LLM response missing content.")
    model_used = data.get("model") or model
    return combined_content, model_used


def _bootstrap_tasks() -> None:
    for order in portal_store.list_orders():
        ensure_task_for_portal_hold(task_store, order)


_bootstrap_tasks()


async def _schedule_compliance_scans() -> None:
    while True:
        try:
            summary = scan_compliance(
                DEFAULT_DATA_DIR,
                as_of=datetime.now(timezone.utc),
                task_store=task_store,
                dispatcher=event_dispatcher,
            )
            logger.info(
                "compliance scan completed alerts=%s tasks_created=%s",
                summary.get("total_alerts"),
                summary.get("total_tasks_created"),
            )
        except Exception as exc:  # pragma: no cover - defensive logging
            logger.exception("Compliance scan failed: %s", exc)
        await asyncio.sleep(COMPLIANCE_SCAN_INTERVAL_SECONDS)


@app.on_event("startup")
async def _on_startup() -> None:
    global _compliance_task
    if _compliance_task is None:
        _compliance_task = asyncio.create_task(_schedule_compliance_scans())
    webhook_worker.start()


@app.on_event("shutdown")
async def _on_shutdown() -> None:
    global _compliance_task
    if _compliance_task:
        _compliance_task.cancel()
        try:
            await _compliance_task
        except asyncio.CancelledError:  # pragma: no cover - expected on shutdown
            pass
        _compliance_task = None
    await webhook_worker.stop()


def _parse_as_of(date_str: str | None) -> datetime:
    if not date_str:
        return datetime.now(timezone.utc)
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%m/%d/%Y"):
        try:
            dt = datetime.strptime(date_str, fmt)
            return dt.replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    raise HTTPException(status_code=400, detail=f"Invalid as_of value: {date_str}")


def _validate_agents(agents: List[str] | None) -> List[str]:
    if not agents:
        return ["ordering", "payments", "workforce", "engagement", "performance", "finance"]
    valid = {"ordering", "payments", "workforce", "engagement", "performance", "finance"}
    unknown = [agent for agent in agents if agent not in valid]
    if unknown:
        raise HTTPException(status_code=400, detail=f"Unknown agents: {', '.join(unknown)}")
    return agents


def _coerce_datetime(value: str | None) -> datetime:
    if not value:
        return datetime.now(timezone.utc)
    try:
        dt = datetime.fromisoformat(value)
    except ValueError:
        return datetime.now(timezone.utc)
    if dt.tzinfo:
        return dt.astimezone(timezone.utc)
    return dt.replace(tzinfo=timezone.utc)


@app.post("/api/agents/run", response_model=AgentRunResponse)
async def run_agents(request: AgentRunRequest) -> AgentRunResponse:
    agents = _validate_agents(request.agents)
    as_of = _parse_as_of(request.as_of)
    payload = orchestrator.run_agents(agents, as_of)
    run_at = datetime.now(timezone.utc)
    event_dispatcher.publish(
        "agent.completed",
        {
            "agents": agents,
            "as_of": as_of.isoformat(),
            "run_at": run_at.isoformat(),
            "trigger": "api",
        },
    )
    return AgentRunResponse(run_at=run_at, agents=agents, payload=payload)


@app.post("/api/run-all", response_model=AgentRunResponse)
async def run_all(request: AgentRunRequest | None = None) -> AgentRunResponse:
    as_of = _parse_as_of(request.as_of if request else None)
    payload = orchestrator.run_all(as_of)
    run_at = datetime.now(timezone.utc)
    event_dispatcher.publish(
        "agent.completed",
        {
            "agents": list(payload.keys()),
            "as_of": as_of.isoformat(),
            "run_at": run_at.isoformat(),
            "trigger": "run_all",
        },
    )
    return AgentRunResponse(run_at=run_at, agents=list(payload.keys()), payload=payload)


@app.get("/api/agents/status", response_model=list[AgentStatusResponse])
async def agent_status() -> list[AgentStatusResponse]:
    statuses = orchestrator.status()
    return [AgentStatusResponse(**status) for status in statuses]


@app.get("/api/last-run")
async def last_run_snapshot() -> dict:
    return orchestrator.snapshot()


@app.post("/api/dashboard/ask", response_model=DashboardChatResponse)
async def ask_dashboard_endpoint(request: DashboardChatRequest) -> DashboardChatResponse:
    if not request.messages:
        raise HTTPException(status_code=400, detail="At least one chat message is required.")
    if not any(message.role == "user" for message in request.messages):
        raise HTTPException(status_code=400, detail="Include a user message in the chat request.")

    context_text = _build_dashboard_context(request.context)
    system_message = ASK_DASHBOARD_SYSTEM_PROMPT
    if context_text:
        system_message = f"{system_message}\n\nDashboard context:\n{context_text}"

    final_messages: List[Mapping[str, str]] = [{"role": "system", "content": system_message}]
    for entry in request.messages:
        final_messages.append({"role": entry.role, "content": entry.content})

    model = request.model or DEFAULT_CHAT_MODEL
    content, model_used = await _call_claude_chat(final_messages, model)
    reply = DashboardChatMessage(role="assistant", content=content)
    return DashboardChatResponse(message=reply, model=model_used)


@app.get("/api/portal/orders", response_model=PortalOrderListResponse)
async def list_portal_orders(status: str | None = None) -> PortalOrderListResponse:
    orders = portal_store.list_orders(status=status)
    return PortalOrderListResponse(orders=[PortalOrderResponse(**order) for order in orders])


@app.get("/api/portal/orders/{order_id}", response_model=PortalOrderResponse)
async def get_portal_order(order_id: str) -> PortalOrderResponse:
    order = portal_store.get_order(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return PortalOrderResponse(**order)


@app.post("/api/portal/orders", response_model=PortalOrderResponse)
async def create_portal_order(request: PortalOrderCreateRequest) -> PortalOrderResponse:
    as_of = datetime.now(timezone.utc)
    assessment = assess_order(
        DEFAULT_DATA_DIR,
        patient_id=request.patient_id,
        supply_sku=request.supply_sku,
        quantity=request.quantity,
        requested_date=request.requested_date,
        as_of=as_of,
    )
    order = portal_store.create_order(request.dict(), assessment, as_of)
    event_dispatcher.publish(
        "order.created",
        {
            "order_id": order.get("id"),
            "patient_id": order.get("patient_id"),
            "status": order.get("status"),
        },
    )
    task = ensure_task_for_portal_hold(task_store, order)
    if task:
        event_dispatcher.publish(
            "task.created",
            {
                "task_id": task.get("id"),
                "task_type": task.get("task_type"),
                "priority": task.get("priority"),
                "order_id": order.get("id"),
            },
        )
    orchestrator.run_agents(["ordering", "performance", "finance"], as_of)
    event_dispatcher.publish(
        "agent.completed",
        {
            "agents": ["ordering", "performance"],
            "as_of": as_of.isoformat(),
            "run_at": datetime.now(timezone.utc).isoformat(),
            "trigger": "portal_order_created",
            "order_id": order.get("id"),
        },
    )
    return PortalOrderResponse(**order)


@app.post("/api/portal/orders/{order_id}/approve", response_model=PortalOrderResponse)
async def approve_portal_order(order_id: str) -> PortalOrderResponse:
    try:
        order = portal_store.update_status(
            order_id,
            status="approved",
            actor="staff",
            note="Approved via portal/dashboard.",
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    closed = task_store.close_tasks_for_order(order_id)
    for task in closed:
        event_dispatcher.publish(
            "task.closed",
            {"task_id": task.get("id"), "order_id": order_id},
        )
    event_dispatcher.publish(
        "order.approved",
        {"order_id": order_id, "patient_id": order.get("patient_id"), "status": order.get("status")},
    )
    now = datetime.now(timezone.utc)
    orchestrator.run_agents(["ordering", "performance", "finance"], now)
    event_dispatcher.publish(
        "agent.completed",
        {
            "agents": ["ordering", "performance"],
            "as_of": now.isoformat(),
            "run_at": datetime.now(timezone.utc).isoformat(),
            "trigger": "portal_order_approved",
            "order_id": order_id,
        },
    )
    return PortalOrderResponse(**order)


@app.get("/api/sla/policy", response_model=SlaPolicyResponse)
async def get_sla_policy() -> SlaPolicyResponse:
    snapshot = sla_service.get_policy_snapshot()
    return SlaPolicyResponse(**snapshot)


@app.post("/api/sla/evaluate", response_model=SlaScoreResponse)
async def evaluate_sla(request: SlaEvaluateRequest) -> SlaScoreResponse:
    score = sla_service.score(request.order_id, emit=request.refresh)
    if score is None:
        raise HTTPException(status_code=404, detail="No events recorded for this order.")
    return SlaScoreResponse(**score.dict())


@app.get("/api/tasks", response_model=TaskListResponse)
async def list_tasks(status: str | None = None, sla_breach: bool = False) -> TaskListResponse:
    if sla_breach:
        raw_tasks = task_store.list_tasks_by_type(["sla_breach"], status=status or "open,in_progress")
    else:
        raw_tasks = task_store.list_tasks(status=status)
    return TaskListResponse(tasks=[TaskResponse(**task) for task in raw_tasks])


@app.post("/api/tasks/{task_id}/acknowledge", response_model=TaskResponse)
async def acknowledge_task(task_id: str, request: TaskAcknowledgeRequest | None = None) -> TaskResponse:
    request = request or TaskAcknowledgeRequest()
    try:
        task = task_store.update_status(task_id, "in_progress", owner=request.owner)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    event_dispatcher.publish(
        "task.acknowledged",
        {"task_id": task_id, "owner": task.get("owner")},
    )
    return TaskResponse(**task)


@app.post("/api/tasks/{task_id}/status", response_model=TaskResponse)
async def update_task_status(task_id: str, request: TaskStatusUpdateRequest) -> TaskResponse:
    try:
        task = task_store.update_status(task_id, request.status, owner=request.owner)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    event_dispatcher.publish(
        "task.updated",
        {
            "task_id": task_id,
            "status": task.get("status"),
            "owner": task.get("owner"),
        },
    )
    if str(request.status).lower() == "closed" and str(task.get("task_type", "")).lower() == "sla_breach":
        metadata = dict(task.get("metadata") or {})
        order_id = metadata.get("sla_order_id") or metadata.get("order_id")
        if order_id:
            sla_service.score(str(order_id), emit=True)
    return TaskResponse(**task)


@app.post("/api/tasks/ingest/portal-holds", response_model=TaskIngestionResponse)
async def ingest_portal_hold_tasks() -> TaskIngestionResponse:
    summary = ingest_portal_holds(
        DEFAULT_DATA_DIR,
        dispatcher=event_dispatcher,
        as_of=datetime.now(timezone.utc),
    )
    return TaskIngestionResponse(**summary)


@app.get("/api/provider/co-pilot", response_model=ProviderCoPilotResponse)
async def provider_co_pilot(status: str | None = None) -> ProviderCoPilotResponse:
    task_types = ["compliance_review", "compliance_radar", "sla_breach"]
    task_status = status or "open,in_progress"
    raw_tasks = task_store.list_tasks_by_type(task_types, status=task_status)
    entries: List[ProviderTaskEntry] = []
    for task in raw_tasks:
        metadata = dict(task.get("metadata") or {})
        patient_id = metadata.get("patient_id") or task.get("patient_id")
        supply_sku = metadata.get("supply_sku") or task.get("supply_sku")
        if task.get("breach_reason") and "breach_reason" not in metadata:
            metadata["breach_reason"] = task.get("breach_reason")
        if task.get("sla_ref") and "sla_ref" not in metadata:
            metadata["sla_ref"] = task.get("sla_ref")

        task_type = str(task.get("task_type", "")).lower()
        guardrail_payload = llm_client.provider_task_summary(
            patient_id=str(patient_id or ""),
            supply_sku=str(supply_sku or ""),
            metadata=metadata,
        )
        if task_type == "sla_breach":
            guardrail_payload = {
                "summary": task.get("breach_reason") or metadata.get("details", "SLA breach requires intervention."),
                "tone": "urgent",
                "risk_level": "critical",
            }
        form_url = None
        if patient_id and supply_sku:
            form_url = f"/api/provider/forms/wopd?patient_id={patient_id}&supply_sku={supply_sku}"
        entries.append(
            ProviderTaskEntry(
                task_id=task.get("id"),
                patient_id=patient_id,
                supply_sku=supply_sku,
                status=task.get("status"),
                priority=task.get("priority"),
                due_at=_coerce_datetime(task.get("due_at")),
                metadata=metadata,
                form_url=form_url,
                guardrail=ProviderTaskGuardrail(**guardrail_payload),
            )
        )
    return ProviderCoPilotResponse(updated_at=datetime.now(timezone.utc), tasks=entries)


@app.get("/api/provider/forms/f2f", response_model=ProviderFormResponse)
async def provider_f2f_form(
    patient_id: str,
    supply_sku: str,
    encounter_date: str | None = None,
    clinician: str | None = None,
    location: str | None = None,
    notes: str | None = None,
) -> ProviderFormResponse:
    metadata = {
        "encounter_date": encounter_date,
        "clinician": clinician,
        "location": location,
        "notes": notes,
    }
    metadata = {key: value for key, value in metadata.items() if value}
    html = render_f2f_template(patient_id, supply_sku, metadata)
    return ProviderFormResponse(html=html)


@app.post("/api/provider/esign", response_model=ProviderESignResponse)
async def provider_esign(request: ProviderESignRequest) -> ProviderESignResponse:
    envelope = create_esign_stub(
        task_id=request.task_id,
        patient_id=request.patient_id,
        supply_sku=request.supply_sku,
        signer_name=request.signer_name,
        signer_email=request.signer_email,
    )
    event_dispatcher.publish(
        "provider.esign.requested",
        {
            "envelope_id": envelope.get("envelope_id"),
            "status": envelope.get("status"),
            "task_id": request.task_id,
            "patient_id": request.patient_id,
            "supply_sku": request.supply_sku,
        },
    )
    expires_at = envelope.get("expires_at")
    expires_at_dt = None
    if isinstance(expires_at, str):
        try:
            expires_at_dt = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
        except ValueError:
            expires_at_dt = datetime.now(timezone.utc) + timedelta(days=3)
    elif isinstance(expires_at, datetime):
        expires_at_dt = expires_at
    else:
        expires_at_dt = datetime.now(timezone.utc) + timedelta(days=3)
    response_payload = {
        "envelope_id": envelope.get("envelope_id", ""),
        "status": envelope.get("status", "sent"),
        "sign_url": envelope.get("sign_url", ""),
        "expires_at": expires_at_dt,
    }
    return ProviderESignResponse(**response_payload)


@app.post("/api/provider/tasks/{task_id}/complete", response_model=ProviderTaskCompleteResponse)
async def provider_complete_task(task_id: str, request: ProviderTaskCompleteRequest) -> ProviderTaskCompleteResponse:
    task = task_store.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
    metadata = dict(task.get("metadata") or {})
    order_id = metadata.get("order_id")
    if not order_id:
        raise HTTPException(status_code=400, detail="Task is not linked to an order")

    closed_task = task_store.update_status(task_id, "closed", owner=request.owner)
    event_dispatcher.publish(
        "task.updated",
        {"task_id": task_id, "status": "closed", "owner": closed_task.get("owner")},
    )
    event_dispatcher.publish("task.closed", {"task_id": task_id, "order_id": order_id})

    extra_closed = task_store.close_tasks_for_order(order_id)
    for entry in extra_closed:
        entry_id = entry.get("id")
        event_dispatcher.publish("task.closed", {"task_id": entry_id, "order_id": order_id})

    note = request.notes or "Approved via Provider Co-Pilot."
    try:
        order = portal_store.update_status(
            order_id,
            status="approved",
            actor="provider",
            note=note,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    event_dispatcher.publish(
        "order.approved",
        {
            "order_id": order_id,
            "patient_id": order.get("patient_id"),
            "status": order.get("status"),
        },
    )

    existing_notes = order.get("ai_notes") or []
    annotated_notes = [note] + list(existing_notes)[:4]
    order = portal_store.update_ai_disposition(order_id, "clear", notes=annotated_notes, actor="provider")
    event_dispatcher.publish(
        "order.disposition.cleared",
        {
            "order_id": order_id,
            "patient_id": order.get("patient_id"),
            "notes": note,
        },
    )

    now = datetime.now(timezone.utc)
    orchestrator.run_agents(["ordering", "performance", "finance"], now)
    event_dispatcher.publish(
        "agent.completed",
        {
            "agents": ["ordering", "performance"],
            "as_of": now.isoformat(),
            "run_at": datetime.now(timezone.utc).isoformat(),
            "trigger": "provider_clearance",
            "order_id": order_id,
        },
    )
    sla_service.score(order_id, emit=True)

    closed_task.setdefault("metadata", {})["provider_notes"] = note
    if request.esign_envelope:
        event_dispatcher.publish(
            "provider.esign.completed",
            {
                "order_id": order_id,
                "task_id": task_id,
                "envelope_id": request.esign_envelope,
            },
        )

    task_response = TaskResponse(**closed_task)
    order_response = PortalOrderResponse(**order)
    return ProviderTaskCompleteResponse(
        task=task_response,
        order=order_response,
        esign_envelope=request.esign_envelope,
    )
@app.get("/api/events/recent", response_model=EventListResponse)
async def recent_events(limit: int = 50) -> EventListResponse:
    events = load_recent_events(DEFAULT_DATA_DIR, limit=limit)
    return EventListResponse(events=events)


@app.get("/api/events/stream")
async def event_stream(request: Request, topics: str | None = None) -> StreamingResponse:
    default_topics = [
        "order.created",
        "order.approved",
        "task.created",
        "task.updated",
        "task.closed",
        "agent.completed",
        "patient.action",
        "inventory.forecast",
    ]
    topic_values = request.query_params.getlist("topic")
    if topic_values:
        selected = [value.strip() for value in topic_values if value.strip()]
    elif topics:
        selected = [topic.strip() for topic in topics.split(",") if topic.strip()]
    else:
        selected = default_topics
    cleanup, queue = event_dispatcher.subscribe_queue(selected or ["*"])
    heartbeat_seconds = 15

    async def _event_generator():
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=heartbeat_seconds)
                except asyncio.TimeoutError:
                    yield ": heartbeat\n\n"
                    continue
                payload = json.dumps(event, default=str)
                yield f"event: {event.get('topic')}\ndata: {payload}\n\n"
        finally:
            cleanup()

    return StreamingResponse(_event_generator(), media_type="text/event-stream")


@app.post("/api/compliance/scan", response_model=ComplianceScanResponse)
async def compliance_scan_endpoint(as_of: str | None = None) -> ComplianceScanResponse:
    when = _parse_as_of(as_of)
    summary = scan_compliance(
        DEFAULT_DATA_DIR,
        as_of=when,
        task_store=task_store,
        dispatcher=event_dispatcher,
    )
    return ComplianceScanResponse(**summary)


@app.post("/api/compliance/report")
async def compliance_report_endpoint(request: ComplianceReportRequest) -> Response:
    generated = datetime.now(timezone.utc)
    pdf_bytes = generate_compliance_pdf(request.alerts, generated_at=generated, title=request.title)
    filename = f"compliance-alerts-{generated.strftime('%Y%m%d%H%M%S')}.pdf"
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return Response(content=pdf_bytes, media_type="application/pdf", headers=headers)


@app.get("/api/provider/forms/wopd", response_model=ProviderFormResponse)
async def provider_wopd_form(patient_id: str, supply_sku: str) -> ProviderFormResponse:
    html = render_wopd_template(patient_id, supply_sku, metadata={})
    return ProviderFormResponse(html=html)


@app.get("/api/inventory/forecast")
async def inventory_forecast(growth: float | None = None) -> Mapping[str, Mapping[str, float | str]]:
    adjustment = float(growth) if growth is not None else 0.0
    forecasts = forecast_inventory(
        DEFAULT_DATA_DIR,
        as_of=datetime.now(timezone.utc),
        growth_adjustment=adjustment,
    )
    event_dispatcher.publish(
        "inventory.forecast",
        {
            "growth_adjustment": adjustment,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "skus": list(forecasts.keys()),
        },
    )
    return forecasts


@app.post("/api/inventory/scenario", response_model=InventoryScenarioResponse)
async def inventory_scenario(request: InventoryScenarioRequest) -> InventoryScenarioResponse:
    scenario = run_inventory_scenario(
        DEFAULT_DATA_DIR,
        as_of=datetime.now(timezone.utc),
        growth_percent=request.growth_percent,
        lead_time_delta=request.lead_time_delta,
        skus=request.skus,
    )
    event_dispatcher.publish(
        "inventory.scenario",
        {
            "growth_percent": scenario["growth_percent"],
            "lead_time_delta": scenario["lead_time_delta"],
            "skus": scenario["skus"],
            "generated_at": scenario["generated_at"].isoformat(),
        },
    )
    return InventoryScenarioResponse(**scenario)


@app.post("/api/payers/eligibility", response_model=PayerEligibilityResponse)
async def payer_eligibility(request: PayerEligibilityRequest) -> PayerEligibilityResponse:
    date_of_service = _parse_as_of(request.date_of_service) if request.date_of_service else None
    result = payer_connector.eligibility_check(
        patient_id=request.patient_id,
        payer_id=request.payer_id,
        policy_number=request.policy_number,
        date_of_service=date_of_service,
    )
    return PayerEligibilityResponse(**result.to_dict())


@app.post("/api/payers/prior-auth", response_model=PayerPriorAuthResponse)
async def payer_prior_auth(request: PayerPriorAuthRequest) -> PayerPriorAuthResponse:
    result = payer_connector.prior_auth_status(
        order_id=request.order_id,
        payer_id=request.payer_id,
        auth_number=request.auth_number,
        supply_sku=request.supply_sku,
    )
    return PayerPriorAuthResponse(**result.to_dict())


@app.post("/api/payers/remits", response_model=PayerRemitResponse)
async def payer_remit(request: PayerRemitRequest) -> PayerRemitResponse:
    result = payer_connector.ingest_remit(
        remit_id=request.remit_id,
        claim_id=request.claim_id,
        payer_id=request.payer_id,
        amount_billed=request.amount_billed,
        amount_paid=request.amount_paid,
        order_id=request.order_id,
    )
    return PayerRemitResponse(**result.to_dict())


@app.post("/api/partners/orders", response_model=PartnerOrderResponse, status_code=201)
async def partner_create_order(request: PartnerOrderCreateRequest) -> PartnerOrderResponse:
    metadata = {key: value for key, value in {"notes": request.notes, "payer_id": request.payer_id}.items() if value is not None}
    record = partner_order_store.create_order(
        partner_id=request.partner_id,
        patient_id=request.patient_id,
        supply_sku=request.supply_sku,
        quantity=request.quantity,
        metadata=metadata,
    )
    event_dispatcher.publish(
        "partner.order.created",
        {
            "order_id": record["order_id"],
            "partner_id": record["partner_id"],
            "supply_sku": record["supply_sku"],
            "quantity": record["quantity"],
        },
    )
    return PartnerOrderResponse(**record)


@app.get("/api/partners/orders", response_model=PartnerOrderListResponse)
async def partner_list_orders(partner_id: str | None = None) -> PartnerOrderListResponse:
    orders = partner_order_store.list_orders(partner_id=partner_id)
    return PartnerOrderListResponse(orders=[PartnerOrderResponse(**order) for order in orders])


@app.post("/api/partners/orders/{order_id}/status", response_model=PartnerOrderResponse)
async def partner_update_order(order_id: str, request: PartnerOrderStatusRequest) -> PartnerOrderResponse:
    try:
        record = partner_order_store.update_order(
            order_id,
            status=request.status,
            compliance_passed=request.compliance_passed,
            amount_paid=request.amount_paid,
            metadata_updates=request.metadata,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    event_dispatcher.publish(
        "partner.order.updated",
        {
            "order_id": record["order_id"],
            "partner_id": record["partner_id"],
            "status": record["status"],
            "compliance_passed": record.get("compliance_passed"),
            "is_paid": record.get("is_paid"),
        },
    )
    return PartnerOrderResponse(**record)


@app.get("/api/partners/usage", response_model=PartnerUsageResponse)
async def partner_usage(partner_id: str, month: str | None = None) -> PartnerUsageResponse:
    summary = partner_order_store.usage_summary(partner_id=partner_id, month=month)
    event_dispatcher.publish(
        "partner.usage.generated",
        {
            "partner_id": partner_id,
            "month": month,
            "total_charges": summary["total_charges"],
            "orders_compliant": summary["compliant_paid_orders"],
        },
    )
    return PartnerUsageResponse(**summary)


@app.get("/api/orders/{order_id}/timeline", response_model=AuditTimelineResponse)
async def audit_order_timeline(order_id: str) -> AuditTimelineResponse:
    timeline = audit_vault.timeline(order_id)
    return AuditTimelineResponse(**timeline.to_dict())


@app.post("/api/orders/{order_id}/attachments", response_model=AuditAttachmentResponse, status_code=201)
async def audit_add_attachment(order_id: str, request: AuditAttachmentRequest) -> AuditAttachmentResponse:
    try:
        payload = base64.b64decode(request.content, validate=True)
    except (binascii.Error, ValueError):
        payload = request.content.encode("utf-8")
    record = audit_vault.add_attachment(
        order_id,
        name=request.name,
        content=payload,
        content_type=request.content_type or "application/octet-stream",
        metadata=request.metadata,
    )
    event_dispatcher.publish(
        "audit.attachment.recorded",
        {
            "order_id": order_id,
            "attachment_id": record["attachment_id"],
            "checksum": record["checksum"],
            "size_bytes": record["size_bytes"],
        },
    )
    return AuditAttachmentResponse(**record)


@app.post("/api/patient-links", response_model=PatientLinkResponse)
async def create_patient_link(request: PatientLinkCreateRequest) -> PatientLinkResponse:
    record = patient_link_store.create_link(
        request.patient_id,
        request.order_id,
        expires_minutes=request.expires_minutes,
    )
    return PatientLinkResponse(
        token=record["token"],
        patient_id=record["patient_id"],
        order_id=record["order_id"],
        created_at=_coerce_datetime(record.get("created_at")),
        expires_at=_coerce_datetime(record.get("expires_at")),
    )


@app.get("/api/patient-links/{token}", response_model=PatientLinkSessionResponse)
async def get_patient_link(token: str) -> PatientLinkSessionResponse:
    record = patient_link_store.validate(token)
    if not record:
        raise HTTPException(status_code=404, detail="Invalid or expired token")
    order = portal_store.get_order(record["order_id"])
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    summary = {
        "patient_id": order.get("patient_id"),
        "order_id": order.get("id"),
        "supply_sku": order.get("supply_sku"),
        "status": order.get("status"),
        "requested_date": order.get("requested_date"),
        "delivery_mode": order.get("delivery_mode"),
        "ai_notes": order.get("ai_notes", []),
    }
    return PatientLinkSessionResponse(
        token=record["token"],
        patient_id=record["patient_id"],
        order_id=record["order_id"],
        expires_at=_coerce_datetime(record.get("expires_at")),
        order_summary=summary,
    )


@app.post("/api/patient-actions", response_model=TaskResponse)
async def patient_action(payload: Mapping[str, object]) -> TaskResponse:
    token = str(payload.get("token") or "")
    record = patient_link_store.validate(token)
    if not record:
        raise HTTPException(status_code=404, detail="Invalid or expired token")
    action = str(payload.get("action") or "")
    notes = payload.get("notes")
    if action not in {"confirm_delivery", "reschedule", "needs_help"}:
        raise HTTPException(status_code=400, detail="Unsupported action")

    task = create_patient_action_task(
        task_store,
        patient_id=record["patient_id"],
        order_id=record["order_id"],
        action=action,
        notes=str(notes or ""),
    )
    orchestrator.run_agents(["finance"], datetime.now(timezone.utc))
    event_dispatcher.publish(
        "patient.action",
        {
            "token": token,
            "patient_id": record["patient_id"],
            "order_id": record["order_id"],
            "action": action,
        },
    )
    return TaskResponse(**task)


@app.get("/api/webhooks", response_model=WebhookListResponse)
async def list_webhooks() -> WebhookListResponse:
    return WebhookListResponse(webhooks=webhook_registry.list())


@app.post("/api/webhooks", response_model=WebhookResponse, status_code=201)
async def create_webhook(request: WebhookCreateRequest) -> WebhookResponse:
    try:
        record = webhook_registry.add(
            str(request.url),
            request.topics,
            secret=request.secret,
            description=request.description,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return WebhookResponse(**record)


@app.delete("/api/webhooks/{webhook_id}", status_code=204)
async def delete_webhook(webhook_id: str) -> Response:
    removed = webhook_registry.remove(webhook_id)
    if not removed:
        raise HTTPException(status_code=404, detail="Webhook not found")
    return Response(status_code=204)


@app.get("/api/webhooks/outbox", response_model=WebhookOutboxListResponse)
async def list_webhook_outbox(limit: int = 50) -> WebhookOutboxListResponse:
    deliveries = webhook_outbox.list_recent(limit=limit)
    return WebhookOutboxListResponse(deliveries=deliveries)


@app.get("/api/config/infrastructure")
async def get_infrastructure_config() -> Mapping[str, object]:
    return infrastructure_config.to_dict()
