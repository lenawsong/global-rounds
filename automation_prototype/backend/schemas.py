"""Pydantic schemas for the automation API."""
from __future__ import annotations

from datetime import datetime
from typing import Any, List, Mapping, Optional

from pydantic import AnyHttpUrl, BaseModel, Field, validator


class AgentRunRequest(BaseModel):
    agents: Optional[List[str]] = Field(
        default=None,
        description="Subset of agents to execute; run all if omitted.",
    )
    as_of: Optional[str] = Field(
        default=None,
        description="As-of date in YYYY-MM-DD format (defaults to today).",
    )

    @validator("agents")
    def _normalize_agents(cls, value: Optional[List[str]]) -> Optional[List[str]]:
        if value:
            return [agent.lower() for agent in value]
        return value


class AgentRunResponse(BaseModel):
    run_at: datetime
    agents: List[str]
    payload: Mapping[str, object]


class AgentStatusResponse(BaseModel):
    agent: str
    last_run: Optional[datetime]
    records: int


class PortalOrderCreateRequest(BaseModel):
    patient_id: str = Field(..., description="Patient identifier associated with the order.")
    supply_sku: str = Field(..., description="Catalog SKU for the requested supply.")
    quantity: int = Field(..., gt=0, description="Requested quantity (units).")
    priority: str = Field(default="routine", description="Order urgency flag.")
    delivery_mode: Optional[str] = Field(default=None, description="Preferred delivery path (warehouse, dropship, auto).")
    requested_date: Optional[str] = Field(default=None, description="Requested fulfillment date (YYYY-MM-DD).")
    notes: Optional[str] = Field(default=None, description="Additional context from the requester.")


class PortalOrderEvent(BaseModel):
    code: str
    actor: str
    note: str
    timestamp: datetime


class PortalOrderResponse(BaseModel):
    id: str
    patient_id: str
    supply_sku: str
    quantity: int
    recommended_quantity: Optional[int]
    requested_date: Optional[str]
    priority: str
    delivery_mode: Optional[str]
    recommended_fulfillment: Optional[str]
    notes: Optional[str]
    status: str
    ai_disposition: str
    ai_compliance_status: Optional[str]
    ai_notes: List[str]
    source: str
    created_at: datetime
    updated_at: datetime
    as_of: Optional[datetime]
    events: List[PortalOrderEvent]


class PortalOrderListResponse(BaseModel):
    orders: List[PortalOrderResponse]


class TaskResponse(BaseModel):
    id: str
    title: str
    task_type: str
    priority: str
    status: str
    owner: Optional[str]
    due_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    sla_ref: Optional[str] = None
    breach_reason: Optional[str] = None
    cycle_time_secs: Optional[int] = None
    first_pass_flag: Optional[bool] = None
    metadata: Mapping[str, object]


class TaskListResponse(BaseModel):
    tasks: List[TaskResponse]


class TaskStatusUpdateRequest(BaseModel):
    status: str
    owner: Optional[str] = None


class TaskAcknowledgeRequest(BaseModel):
    owner: Optional[str] = None


class TaskIngestionResponse(BaseModel):
    processed_orders: int
    tasks_created: int
    task_ids: List[str]
    run_at: datetime


class EventResponse(BaseModel):
    topic: str
    payload: Mapping[str, object]
    timestamp: datetime


class EventListResponse(BaseModel):
    events: List[EventResponse]


class SlaEvaluateRequest(BaseModel):
    order_id: str
    refresh: bool = Field(default=False, description="Publish the score and sync tasks on evaluation.")


class SlaSpecPayload(BaseModel):
    name: str
    metric: str
    threshold: Any
    window: str
    credit_rule: Mapping[str, Any]


class SlaMetricPayload(BaseModel):
    spec_name: str
    metric: str
    passed: bool
    observed: Optional[Any]
    threshold: Any
    window: str
    credits: float
    notes: Optional[str] = None


class SlaBreachPayload(BaseModel):
    spec_name: str
    metric: str
    observed: Optional[Any]
    threshold: Any
    occurred_at: datetime
    credits: float
    details: Optional[str] = None


class SlaScoreResponse(BaseModel):
    order_id: str
    evaluated_at: datetime
    policy_version: str
    metrics: List[SlaMetricPayload]
    breaches: List[SlaBreachPayload]
    total_credits: float
    volume_tier: str


class SlaPolicyResponse(BaseModel):
    version: str
    specs: List[SlaSpecPayload]


class ComplianceAlert(BaseModel):
    patient_id: str
    supply_sku: str
    due_date: Optional[str]
    severity: str
    notes: str


class ComplianceScanResponse(BaseModel):
    run_at: datetime
    total_alerts: int
    total_tasks_created: int
    alerts: List[ComplianceAlert]
    tasks_created: List[str]


class ComplianceReportRequest(BaseModel):
    title: Optional[str] = Field(default="Compliance Alert Packet")
    alerts: List[ComplianceAlert] = Field(default_factory=list)


class ProviderFormResponse(BaseModel):
    html: str


class PatientLinkCreateRequest(BaseModel):
    patient_id: str
    order_id: str
    expires_minutes: int = Field(default=60, ge=1, le=1440)


class PatientLinkResponse(BaseModel):
    token: str
    patient_id: str
    order_id: str
    created_at: datetime
    expires_at: datetime


class PatientLinkSessionResponse(BaseModel):
    token: str
    patient_id: str
    order_id: str
    expires_at: datetime
    order_summary: Mapping[str, object]


class InventoryScenarioRequest(BaseModel):
    growth_percent: float = Field(
        default=0.0,
        description="Percent growth adjustment to apply (e.g., 15.0 for +15%).",
        ge=-100.0,
        le=500.0,
    )
    lead_time_delta: int = Field(
        default=0,
        description="Additional days to add to baseline lead time (negative to reduce).",
        ge=-30,
        le=120,
    )
    skus: Optional[List[str]] = Field(
        default=None,
        description="Optional list of SKUs to scope the scenario output.",
    )


class InventoryScenarioResponse(BaseModel):
    generated_at: datetime
    growth_percent: float
    lead_time_delta: int
    lead_time_applied: int
    skus: List[str]
    baseline: Mapping[str, Mapping[str, Any]]
    scenario: Mapping[str, Mapping[str, Any]]
    deltas: Mapping[str, Mapping[str, float]]


class PayerEligibilityRequest(BaseModel):
    patient_id: str
    payer_id: str
    policy_number: str
    date_of_service: Optional[str] = Field(
        default=None,
        description="Date of service (YYYY-MM-DD) to contextualize the eligibility pull.",
    )


class PayerEligibilityResponse(BaseModel):
    patient_id: str
    payer_id: str
    policy_number: str
    coverage_status: str
    deductible_met: bool
    copay_amount: float
    effective_date: datetime
    checked_at: datetime


class PayerPriorAuthRequest(BaseModel):
    order_id: str
    payer_id: str
    auth_number: str
    supply_sku: Optional[str] = None


class PayerPriorAuthResponse(BaseModel):
    order_id: str
    payer_id: str
    auth_number: str
    status: str
    reason: str
    expires_at: datetime


class PayerRemitRequest(BaseModel):
    remit_id: str
    claim_id: str
    payer_id: str
    amount_billed: float
    amount_paid: float
    order_id: Optional[str] = None


class PayerRemitResponse(BaseModel):
    remit_id: str
    claim_id: str
    payer_id: str
    order_id: Optional[str] = None
    amount_billed: float
    amount_paid: float
    variance: float
    status: str
    processed_at: datetime
    tasks_closed: List[str]


class PartnerOrderCreateRequest(BaseModel):
    partner_id: str
    patient_id: str
    supply_sku: str
    quantity: int = Field(..., gt=0)
    notes: Optional[str] = Field(default=None)
    payer_id: Optional[str] = Field(default=None)


class PartnerOrderResponse(BaseModel):
    order_id: str
    partner_id: str
    patient_id: str
    supply_sku: str
    quantity: int
    status: str
    compliance_passed: bool
    is_paid: bool
    amount_paid: float
    created_at: datetime
    updated_at: datetime
    metadata: Mapping[str, object]


class PartnerOrderListResponse(BaseModel):
    orders: List[PartnerOrderResponse]


class PartnerOrderStatusRequest(BaseModel):
    status: Optional[str] = Field(default=None)
    compliance_passed: Optional[bool] = Field(default=None)
    amount_paid: Optional[float] = Field(default=None)
    metadata: Optional[Mapping[str, object]] = Field(default=None)


class PartnerUsageResponse(BaseModel):
    partner_id: str
    month: Optional[str]
    orders_total: int
    compliant_paid_orders: int
    order_fee: float
    total_charges: float
    orders: List[Mapping[str, object]]


class AuditAttachmentRequest(BaseModel):
    name: str
    content: str = Field(
        ..., description="Base64-encoded attachment payload (falls back to UTF-8 literal if invalid)."
    )
    content_type: Optional[str] = Field(
        default="application/octet-stream",
        description="MIME type to associate with the attachment.",
    )
    metadata: Optional[Mapping[str, Any]] = Field(default=None)


class AuditAttachmentResponse(BaseModel):
    attachment_id: str
    order_id: str
    name: str
    content_type: str
    checksum: str
    size_bytes: int
    stored_at: datetime
    metadata: Mapping[str, object]
    content_b64: str


class AuditTimelineResponse(BaseModel):
    order_id: str
    generated_at: datetime
    events: List[Mapping[str, object]]
    attachments: List[Mapping[str, object]]


class WebhookCreateRequest(BaseModel):
    url: AnyHttpUrl
    topics: List[str] = Field(..., min_items=1)
    secret: Optional[str] = None
    description: Optional[str] = None


class WebhookResponse(BaseModel):
    id: str
    url: AnyHttpUrl
    topics: List[str]
    secret: Optional[str]
    description: Optional[str]
    created_at: datetime


class WebhookListResponse(BaseModel):
    webhooks: List[WebhookResponse]


class WebhookOutboxEntry(BaseModel):
    id: str
    webhook_id: Optional[str]
    url: AnyHttpUrl
    topic: str
    payload: Mapping[str, object]
    timestamp: Optional[datetime]
    queued_at: datetime
    status: str
    attempts: Optional[int]
    delivered_at: Optional[datetime]
    updated_at: Optional[datetime]
    error: Optional[str]


class WebhookOutboxListResponse(BaseModel):
    deliveries: List[WebhookOutboxEntry]


class ProviderTaskGuardrail(BaseModel):
    summary: str
    tone: str
    risk_level: str


class ProviderTaskEntry(BaseModel):
    task_id: str
    patient_id: Optional[str]
    supply_sku: Optional[str]
    status: str
    priority: str
    due_at: Optional[datetime]
    metadata: Mapping[str, object]
    form_url: Optional[str]
    guardrail: ProviderTaskGuardrail


class ProviderCoPilotResponse(BaseModel):
    updated_at: datetime
    tasks: List[ProviderTaskEntry]


class ProviderTaskCompleteRequest(BaseModel):
    owner: Optional[str] = None
    notes: Optional[str] = None
    esign_envelope: Optional[str] = None


class ProviderTaskCompleteResponse(BaseModel):
    task: TaskResponse
    order: PortalOrderResponse
    esign_envelope: Optional[str] = None


class ProviderESignRequest(BaseModel):
    task_id: Optional[str] = None
    patient_id: Optional[str] = None
    supply_sku: Optional[str] = None
    signer_name: Optional[str] = None
    signer_email: Optional[str] = None


class ProviderESignResponse(BaseModel):
    envelope_id: str
    status: str
    sign_url: str
    expires_at: datetime


class DashboardChatMessage(BaseModel):
    role: str
    content: str

    @validator("role")
    def _normalize_role(cls, value: str) -> str:
        normalized = value.lower().strip()
        allowed = {"user", "assistant", "system"}
        if normalized not in allowed:
            raise ValueError(f"Unsupported role '{value}'.")
        return normalized


class DashboardChatRequest(BaseModel):
    messages: List[DashboardChatMessage]
    context: Optional[Mapping[str, Any]] = None
    model: Optional[str] = Field(
        default=None,
        description="Override the default Ollama model for this request.",
    )


class DashboardChatResponse(BaseModel):
    message: DashboardChatMessage
    model: Optional[str] = None
