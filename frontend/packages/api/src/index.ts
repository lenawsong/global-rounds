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
}

