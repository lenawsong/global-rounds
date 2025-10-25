'use client';

import { useQuery } from '@tanstack/react-query';
import { createApiClient } from '../lib/api';
import { Badge, Button, Card, CardBody, CardSubtle, CardTitle, Metric, Shell } from '@gr/ui';
import Link from 'next/link';
import { VegaChart, Specs } from '@gr/charts';

const api = createApiClient();

export function OverviewClient() {
  const { data: snapshot } = useQuery({ queryKey: ['dashboard-snapshot'], queryFn: () => api.getDashboardSnapshot() });
  const { data: tasks } = useQuery({ queryKey: ['tasks'], queryFn: () => api.listTasks() });
  const { data: orders } = useQuery({ queryKey: ['orders'], queryFn: () => api.listPortalOrders() });

  const totalTasks = tasks?.tasks.length ?? 0;
  const openTasks = tasks?.tasks.filter((t) => t.status.toLowerCase() !== 'closed').length ?? 0;
  const approvals = orders?.orders.filter((o) => o.status === 'approved').length ?? 0;

  const queueDonut = buildQueueDonut(tasks?.tasks || []);
  const complianceDonut = buildCompliance(snapshot);

  return (
    <Shell
      title="Global Rounds Command Center"
      description="World-class automation cockpit for durable medical equipment operations."
      primaryAction={(
        <a href="/command-center/patient/intake.html" className="inline-flex">
          <Button>New Patient Intake</Button>
        </a>
      )}
      tabs={[
        { key: 'overview', label: 'Overview', href: '/' },
        { key: 'ops', label: 'Ops', href: '/ops' },
        { key: 'finance', label: 'Finance', href: '/finance' },
        { key: 'inventory', label: 'Inventory', href: '/inventory' },
        { key: 'engagement', label: 'Engagement', href: '/engagement' },
        { key: 'scenarios', label: 'Scenarios', href: '/scenarios' }
      ]}
      activeTab="overview"
    >
      <section className="grid gap-4 md:grid-cols-3">
        <Metric label="Active tasks" value={openTasks} sublabel={`${totalTasks} total`} trend="↑ refreshed in real-time" />
        <Metric label="AI approved orders" value={approvals} sublabel="Past 7 days" />
        <Metric label="Automation coverage" value={formatPercent(snapshot)} sublabel="Workflows monitored" />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>Unified queue status</CardTitle>
          <CardSubtle>Distribution of open, in-progress, and closed work.</CardSubtle>
          <CardBody>
            <div className="grid gap-4 md:grid-cols-[240px_1fr]">
              <div className="flex flex-col gap-3 text-sm text-slate-600">
                <Badge variant="brand">Operations</Badge>
                <p>Every task in the rail is synced with SLA references. Hover the chart to see breakdowns by status.</p>
                <Link href="/ops" className="text-blue-600 transition hover:text-blue-700">Go to Ops →</Link>
              </div>
              <VegaChart spec={Specs.donutSpec()} data={{ table: queueDonut }} />
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardTitle>Compliance readiness</CardTitle>
          <CardSubtle>Hold vs clear vs unknown compliance status across patient work orders.</CardSubtle>
          <CardBody>
            <div className="grid gap-4 md:grid-cols-[240px_1fr]">
              <div className="flex flex-col gap-3 text-sm text-slate-600">
                <Badge variant="warning">Compliance</Badge>
                <p>Quickly identify orders requiring provider attention before fulfillment.</p>
                <Link href="/inventory" className="text-blue-600 transition hover:text-blue-700">Go to Inventory →</Link>
              </div>
              <VegaChart spec={Specs.donutSpec()} data={{ table: complianceDonut }} />
            </div>
          </CardBody>
        </Card>
      </section>
    </Shell>
  );
}

function buildQueueDonut(tasks: import('@gr/api').TaskItem[]) {
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

function buildCompliance(snapshot?: import('@gr/api').DashboardSnapshot) {
  const orders = Array.isArray(snapshot?.ordering?.patient_work_orders)
    ? (snapshot?.ordering?.patient_work_orders as any[])
    : [];
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

function formatPercent(snapshot?: import('@gr/api').DashboardSnapshot) {
  const ordering = Array.isArray(snapshot?.ordering?.patient_work_orders)
    ? (snapshot?.ordering?.patient_work_orders as any[])
    : [];
  if (!ordering.length) return '—';
  const clear = ordering.filter((o) => String(o?.compliance_status || 'clear').toLowerCase() === 'clear').length;
  return `${Math.round((clear / ordering.length) * 100)}%`; 
}

