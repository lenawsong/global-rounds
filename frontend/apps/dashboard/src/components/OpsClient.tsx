'use client';

import { createApiClient } from '../lib/api';
import { Badge, Button, Card, CardBody, CardSubtle, CardTitle, Shell } from '@gr/ui';
import { DonutChart } from '@gr/charts-antv';
import { useDashboardSnapshot, useDashboardTasks } from '../hooks/useDashboardData';

const api = createApiClient();

export function OpsClient() {
  const { data: tasksData, isFallback: tasksFallback } = useDashboardTasks();
  const { data: snapshot } = useDashboardSnapshot();
  const orders = Array.isArray(snapshot?.ordering?.patient_work_orders)
    ? (snapshot?.ordering?.patient_work_orders as any[])
    : [];

  const queue = buildQueue(tasksData.tasks || []);
  const compliance = buildCompliance(orders);

  return (
    <Shell
      title="Operations Intelligence"
      description="Track every task, compliance hold, and automation assist from intake through fulfillment."
      primaryAction={<Button onClick={() => api.runAgents(['ordering'])}>Run ordering agent</Button>}
      tabs={[
        { key: 'overview', label: 'Overview', href: '/' },
        { key: 'ops', label: 'Ops', href: '/ops' },
        { key: 'finance', label: 'Finance', href: '/finance' },
        { key: 'inventory', label: 'Inventory', href: '/inventory' },
        { key: 'engagement', label: 'Engagement', href: '/engagement' },
        { key: 'scenarios', label: 'Scenarios', href: '/scenarios' }
      ]}
      activeTab="ops"
    >
      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardTitle>Unified queue mix</CardTitle>
          <CardSubtle>Live snapshot of open, in progress, and closed work items.</CardSubtle>
          <CardBody className="overflow-visible">
            <div className="grid gap-6 md:grid-cols-[260px_1fr]">
              <div className="space-y-3 text-sm text-slate-600">
                <Badge variant="brand">Tasks</Badge>
                <p>
                  {queue.reduce((acc, item) => acc + item.value, 0)} tasks synced from automation agents with SLA context
                  and guardrails.
                </p>
                <ul className="space-y-1 text-xs">
                  {queue.map((item) => (
                    <li key={item.label} className="flex items-center justify-between">
                      <span>{item.label}</span>
                      <span className="font-semibold text-slate-900">{item.value}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <DonutChart data={queue} />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardTitle>Compliance triage</CardTitle>
          <CardSubtle>Patient work orders categorized by compliance disposition.</CardSubtle>
          <CardBody className="overflow-visible">
            <div className="grid gap-6 md:grid-cols-[260px_1fr]">
              <div className="space-y-3 text-sm text-slate-600">
                <Badge variant="warning">Compliance</Badge>
                <p>
                  {orders.length} work orders monitored. {compliance.find((d) => d.label === 'Hold')?.value ?? 0} require
                  immediate clinician review.
                </p>
                <Button variant="secondary" className="mt-2" onClick={() => api.runAgents(['ordering'])}>
                  Re-evaluate holds
                </Button>
              </div>
              <DonutChart data={compliance} />
            </div>
          </CardBody>
        </Card>
      </section>

      <section className="grid gap-6">
        <Card>
          <CardTitle className="flex items-center justify-between">
            <span>Task Inbox</span>
            <Button variant="secondary" onClick={handleComplianceExport}>Export Compliance PDF</Button>
          </CardTitle>
          <CardSubtle>Top workload requiring operator attention.</CardSubtle>
          <CardBody>
            <div className="overflow-hidden rounded-2xl border border-slate-200/70">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Task</th>
                    <th className="px-4 py-3 text-left">Type</th>
                    <th className="px-4 py-3 text-left">Priority</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(tasksData.tasks || []).slice(0, 8).map((task) => (
                    <tr key={task.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-medium text-slate-900">{task.title}</td>
                      <td className="px-4 py-3 text-slate-600">{task.task_type}</td>
                      <td className="px-4 py-3">
                        <Badge variant={priorityVariant(task.priority)}>{task.priority.toUpperCase()}</Badge>
                      </td>
                      <td className="px-4 py-3 capitalize text-slate-600">{task.status}</td>
                      <td className="px-4 py-3 text-slate-500">{formatDate(task.due_at)}</td>
                    </tr>
                  ))}
                  {!tasksData.tasks?.length ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                        No tasks found.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      </section>
    </Shell>
  );
}

function buildQueue(tasks: import('@gr/api').TaskItem[]) {
  const counts = { open: 0, in_progress: 0, closed: 0 };
  tasks.forEach((task) => {
    const status = task.status.toLowerCase();
    if (status === 'closed') counts.closed += 1;
    else if (status === 'in_progress') counts.in_progress += 1;
    else counts.open += 1;
  });
  return [
    { label: 'Open', value: counts.open },
    { label: 'In Progress', value: counts.in_progress },
    { label: 'Closed', value: counts.closed }
  ];
}

function buildCompliance(orders: any[]) {
  const counts = { clear: 0, hold: 0, unknown: 0 };
  orders.forEach((order) => {
    const status = String(order?.compliance_status || 'unknown').toLowerCase();
    if (counts[status as keyof typeof counts] !== undefined) counts[status as keyof typeof counts] += 1;
    else counts.unknown += 1;
  });
  return [
    { label: 'Clear', value: counts.clear },
    { label: 'Hold', value: counts.hold },
    { label: 'Unknown', value: counts.unknown }
  ];
}

function priorityVariant(priority: string) {
  const normalized = priority.toLowerCase();
  if (normalized === 'high') return 'danger';
  if (normalized === 'urgent' || normalized === 'stat') return 'warning';
  return 'neutral';
}

function formatDate(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  return date.toLocaleDateString();
}

async function handleComplianceExport() {
  try {
    const snapshot = await createApiClient().getDashboardSnapshot();
    const alerts = Array.isArray((snapshot as any)?.ordering?.compliance_alerts) ? (snapshot as any).ordering.compliance_alerts : [];
    const blob = await createApiClient().exportCompliancePdf('Compliance Alert Packet', alerts);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'compliance-alerts.pdf'; a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    alert('Failed to export PDF. Ensure API is running.');
  }
}
