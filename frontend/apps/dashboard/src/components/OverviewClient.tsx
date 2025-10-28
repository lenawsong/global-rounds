'use client';

import Link from 'next/link';
import { Chart } from './viz/Chart';
import { SpecsCompat as Specs } from '@gr/charts';
import { AppLayout } from './layout/AppLayout';
import { dashboardMenu } from './layout/menu';
import { Badge, Button, Card, CardBody, CardSubtle, CardTitle, Metric } from './ui/antd-primitives';
import { withLoadingState } from './ui/withLoadingState';
import { HeroSurface } from './HeroSurface';
import { useDashboardSnapshot, useDashboardTasks, usePortalOrders } from '../hooks/useDashboardData';

const DASHBOARD_VITE_URL =
  process.env.NEXT_PUBLIC_DASHBOARD_VITE_URL ||
  (process.env.NODE_ENV === 'development' ? 'http://localhost:3001' : '/dashboard');
const DASHBOARD_VITE_BASE = DASHBOARD_VITE_URL.replace(/\/$/, '');

const MetricsPanel = withLoadingState(function MetricsPanel({
  openTasks,
  totalTasks,
  approvals,
  coverage
}: {
  openTasks: number;
  totalTasks: number;
  approvals: number;
  coverage: string;
}) {
  return (
    <section className="grid gap-4 md:grid-cols-3">
      <Metric label="Active tasks" value={openTasks} sublabel={`${totalTasks} total`} trend="↑ refreshed in real-time" />
      <Metric label="AI approved orders" value={approvals} sublabel="Past 7 days" />
      <Metric label="Automation coverage" value={coverage} sublabel="Workflows monitored" />
    </section>
  );
}, { active: true, title: false, paragraph: false });

export function OverviewClient() {
  const { data: snapshot, isLoading: snapshotLoading } = useDashboardSnapshot();
  const { data: tasks, isLoading: tasksLoading } = useDashboardTasks();
  const { data: orders, isLoading: ordersLoading } = usePortalOrders();

  const totalTasks = tasks?.tasks.length ?? 0;
  const openTasks = tasks?.tasks.filter((t) => t.status.toLowerCase() !== 'closed').length ?? 0;
  const approvals = orders?.orders.filter((o) => o.status === 'approved').length ?? 0;

  const queueDonut = buildQueueDonut(tasks?.tasks || []);
  const complianceDonut = buildCompliance(snapshot);
  const isLoading = snapshotLoading || tasksLoading || ordersLoading;

  return (
    <AppLayout
      title="Nexus Health Command Center"
      description="World-class automation cockpit for durable medical equipment operations."
      activeKey="overview"
      menuItems={dashboardMenu.map((item) => ({ ...item }))}
      primaryAction={
        <Button href={`${DASHBOARD_VITE_BASE}/intake`} target="_blank" rel="noreferrer">
          New Patient Intake
        </Button>
      }
    >
      <MetricsPanel
        loading={isLoading}
        openTasks={openTasks}
        totalTasks={totalTasks}
        approvals={approvals}
        coverage={formatPercent(snapshot)}
      />

      <section className="grid gap-6">
        <Card>
          <CardTitle>Backlog surface</CardTitle>
          <CardSubtle>Hero view of backlog intensity by compliance status and forecast horizon.</CardSubtle>
          <CardBody>
            <HeroSurface />
          </CardBody>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>Unified queue status</CardTitle>
          <CardSubtle>Distribution of open, in-progress, and closed work.</CardSubtle>
          <CardBody className="overflow-visible">
            <div className="grid gap-4 md:grid-cols-[240px_1fr]">
              <div className="flex flex-col gap-3 text-sm text-slate-600">
                <Badge variant="brand">Operations</Badge>
                <p className="text-sm text-slate-500">
                  Every task in the rail is synced with SLA references. Hover the chart to see breakdowns by status.
                </p>
                <Button variant="ghost" className="!px-0" href="/ops">
                  Go to Ops →
                </Button>
              </div>
              <Chart type={Specs.donutSpec().type} data={{ table: queueDonut }} height={280} />
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardTitle>Compliance readiness</CardTitle>
          <CardSubtle>Hold vs clear vs unknown compliance status across patient work orders.</CardSubtle>
          <CardBody className="overflow-visible">
            <div className="grid gap-4 md:grid-cols-[240px_1fr]">
              <div className="flex flex-col gap-3 text-sm text-slate-600">
                <Badge variant="warning">Compliance</Badge>
                <p className="text-sm text-slate-500">
                  Quickly identify orders requiring provider attention before fulfillment.
                </p>
                <Link href="/inventory" className="text-blue-600">
                  View inventory intelligence →
                </Link>
              </div>
              <Chart type={Specs.donutSpec().type} data={{ table: complianceDonut }} height={280} />
            </div>
          </CardBody>
        </Card>
      </section>
    </AppLayout>
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
