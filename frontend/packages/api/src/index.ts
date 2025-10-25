export interface AgentRunResponse {
  run_at: string;
  agents: string[];
  payload: Record<string, unknown>;
}

export interface TaskItem {
  id: string;
  title: string;
  task_type: string;
  priority: string;
  status: string;
  due_at?: string;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown>;
}

export interface TaskListResponse { tasks: TaskItem[] }

export interface DashboardSnapshot {
  ordering?: Record<string, unknown>;
  payments?: Record<string, unknown>;
  workforce?: Record<string, unknown>;
  engagement?: Record<string, unknown>;
  performance?: Record<string, unknown>;
  finance?: Record<string, unknown>;
}

export interface PortalOrder {
  id: string;
  patient_id: string;
  supply_sku: string;
  quantity: number;
  status: string;
  requested_date?: string;
  ai_compliance_status?: string;
  created_at: string;
}

export interface PortalOrderListResponse { orders: PortalOrder[] }

export interface InventoryScenarioRequest {
  growth_percent: number;
  lead_time_delta: number;
  skus?: string[];
}

export interface InventoryScenarioResponse {
  generated_at: string;
  growth_percent: number;
  lead_time_delta: number;
  scenario: Record<string, Record<string, number>>;
  deltas: Record<string, Record<string, number>>;
}

export interface AgentStatus {
  agent: string;
  last_run?: string | null;
  records: number;
}

export interface DashboardChatMessage { role: 'system' | 'user' | 'assistant'; content: string }
export interface DashboardChatRequest {
  messages: DashboardChatMessage[];
  context?: Record<string, unknown>;
  model?: string | null;
}
export interface DashboardChatResponse { message: DashboardChatMessage; model?: string | null }

export class GrApiClient {
  constructor(private base = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8001') {}

  private url(path: string) { return `${this.base.replace(/\/$/, '')}${path}`; }

  async getJson<T>(path: string): Promise<T> {
    const res = await fetch(this.url(path), { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<T>;
  }

  async postJson<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(this.url(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<T>;
  }

  listTasks() { return this.getJson<TaskListResponse>('/api/tasks'); }
  runAgents(agents?: string[]) { return this.postJson<AgentRunResponse>('/api/agents/run', { agents }); }
  getDashboardSnapshot() { return this.getJson<DashboardSnapshot>('/api/last-run'); }
  listPortalOrders() { return this.getJson<PortalOrderListResponse>('/api/portal/orders'); }
  runInventoryScenario(payload: InventoryScenarioRequest) {
    return this.postJson<InventoryScenarioResponse>('/api/inventory/scenario', payload);
  }
  listAgentStatus() { return this.getJson<AgentStatus[]>('/api/agents/status'); }
  askDashboard(body: DashboardChatRequest) { return this.postJson<DashboardChatResponse>('/api/dashboard/ask', body); }
  async exportCompliancePdf(title: string, alerts: any[]): Promise<Blob> {
    const res = await fetch(this.url('/api/compliance/report'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, alerts })
    });
    if (!res.ok) throw new Error(await res.text());
    return res.blob();
  }
}
