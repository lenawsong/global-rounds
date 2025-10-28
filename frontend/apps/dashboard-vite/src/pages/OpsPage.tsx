import { useMemo, useState } from 'react';
import { Row, Col, Typography, Button, Space, Input, message, Tag } from 'antd';
import type { TaskItem } from '@gr/api';
import { ChartCard } from '../components/ChartCard';
import { DonutChart } from '../components/charts/DonutChart';
import { S2Table, S2Column } from '../components/tables/S2Table';
import { createApiClient } from '../lib/api';
import { useDashboardSnapshot, useDashboardTasks } from '../hooks/useDashboardData';
import { useFilterStore } from '../store/filters';

const api = createApiClient();

export function OpsPage() {
  const { data: tasksData, isLoading: tasksLoading } = useDashboardTasks();
  const { data: snapshot, isLoading: snapshotLoading } = useDashboardSnapshot();
  const { filters } = useFilterStore();
  const [search, setSearch] = useState('');

  const tasks = useMemo(() => {
    const base = tasksData.tasks ?? [];
    if (filters.payer) {
      const lowered = filters.payer.toLowerCase();
      return base
        .filter((task) => task.metadata?.payer?.toLowerCase?.().includes(lowered))
        .filter((task) => withinDateRange(task.due_at, filters.dateRange));
    }
    return base.filter((task) => withinDateRange(task.due_at, filters.dateRange));
  }, [tasksData.tasks, filters.payer, filters.dateRange]);
  const filteredTasks = useMemo(() => {
    if (!search) return tasks;
    const lowered = search.toLowerCase();
    return tasks.filter(
      (task) =>
        task.title.toLowerCase().includes(lowered) ||
        task.task_type?.toLowerCase().includes(lowered) ||
        task.metadata?.notes?.toLowerCase?.().includes(lowered)
    );
  }, [tasks, search]);

  const queueData = useMemo(() => buildQueue(tasks), [tasks]);

  const orders = useMemo(() => {
    const base = Array.isArray(snapshot?.ordering?.patient_work_orders)
      ? (snapshot?.ordering?.patient_work_orders as any[])
      : [];
    if (filters.deviceCategory) {
      const lowered = filters.deviceCategory.toLowerCase();
      return base.filter((order) => String(order?.supply_sku || '').toLowerCase().includes(lowered));
    }
    return base;
  }, [snapshot, filters.deviceCategory]);
  const complianceData = useMemo(() => buildCompliance(orders), [orders]);

  const columns: S2Column[] = [
    { field: 'title', title: 'Task', width: 260 },
    { field: 'task_type', title: 'Type', width: 160 },
    { field: 'priority', title: 'Priority', width: 120 },
    { field: 'status', title: 'Status', width: 140 },
    { field: 'due_at', title: 'Due', width: 160 }
  ];

  const tableData = filteredTasks.map((task) => ({
    title: task.title,
    task_type: task.task_type,
    priority: task.priority.toUpperCase(),
    status: capitalize(task.status),
    due_at: formatDate(task.due_at)
  }));

  const loading = tasksLoading || snapshotLoading;

  return (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <ChartCard
            title="Unified queue mix"
            subTitle="Live snapshot of open, in progress, and closed work items."
            extra={<Tag color="blue">Tasks</Tag>}
            loading={loading}
            footer={
              <Typography.Text type="secondary">
                {tasks.length} tasks monitored with SLA context and guardrails.
              </Typography.Text>
            }
          >
            <div style={{ display: 'grid', gap: 16, gridTemplateColumns: '240px 1fr' }}>
              <Space direction="vertical" size={8}>
                {queueData.map((item) => (
                  <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span>{item.label}</span>
                    <Typography.Text strong>{item.value}</Typography.Text>
                  </div>
                ))}
              </Space>
              <DonutChart data={queueData} />
            </div>
          </ChartCard>
        </Col>
        <Col xs={24} lg={12}>
          <ChartCard
            title="Compliance triage"
            subTitle="Patient work orders categorized by compliance disposition."
            extra={<Tag color="orange">Compliance</Tag>}
            loading={loading}
            footer={
              <Button type="link" onClick={() => api.runAgents(['ordering'])}>
                Re-evaluate holds
              </Button>
            }
          >
            <div style={{ display: 'grid', gap: 16, gridTemplateColumns: '240px 1fr' }}>
              <Space direction="vertical" size={8}>
                <Typography.Text>
                  {orders.length} work orders monitored.{' '}
                  <Typography.Text strong>
                    {complianceData.find((d) => d.label === 'Hold')?.value ?? 0}
                  </Typography.Text>{' '}
                  require clinician review.
                </Typography.Text>
              </Space>
              <DonutChart data={complianceData} />
            </div>
          </ChartCard>
        </Col>
      </Row>

      <ChartCard
        title="Task Inbox"
        subTitle="Top workload requiring operator attention."
        extra={
          <Space>
            <Input
              allowClear
              placeholder="Search tasks"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              style={{ width: 220 }}
            />
            <Button onClick={handleExportPdf}>Export Compliance PDF</Button>
          </Space>
        }
        loading={loading}
      >
        <S2Table data={tableData} columns={columns} height={420} />
      </ChartCard>
    </Space>
  );
}

async function handleExportPdf() {
  try {
    const snapshot = await api.getDashboardSnapshot();
    const alerts = Array.isArray((snapshot as any)?.ordering?.compliance_alerts)
      ? (snapshot as any).ordering.compliance_alerts
      : [];
    const blob = await api.exportCompliancePdf('Compliance Alert Packet', alerts);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'compliance-alerts.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    message.success('Compliance PDF exported');
  } catch (error) {
    message.error('Failed to export PDF. Ensure API is running.');
  }
}

function buildQueue(tasks: TaskItem[]) {
  const counts = { Open: 0, 'In Progress': 0, Closed: 0 };
  tasks.forEach((task) => {
    const status = task.status.toLowerCase();
    if (status === 'closed') counts.Closed += 1;
    else if (status === 'in_progress' || status === 'in progress') counts['In Progress'] += 1;
    else counts.Open += 1;
  });
  return Object.entries(counts).map(([label, value]) => ({ label, value }));
}

function buildCompliance(orders: any[]) {
  const counts = { Clear: 0, Hold: 0, Unknown: 0 };
  orders.forEach((order) => {
    const status = String(order?.compliance_status || 'unknown').toLowerCase();
    if (status === 'clear') counts.Clear += 1;
    else if (status === 'hold') counts.Hold += 1;
    else counts.Unknown += 1;
  });
  return Object.entries(counts).map(([label, value]) => ({ label, value }));
}

function formatDate(value?: string) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
}

function capitalize(text: string) {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function withinDateRange(dateValue: string | undefined, range?: [string, string]) {
  if (!range || !range[0] || !range[1]) return true;
  if (!dateValue) return false;
  const date = new Date(dateValue).getTime();
  const start = new Date(range[0]).getTime();
  const end = new Date(range[1]).getTime();
  return date >= start && date <= end;
}
