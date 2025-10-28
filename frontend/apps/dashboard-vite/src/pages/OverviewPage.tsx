import { useMemo } from 'react';
import { Row, Col, Space, Typography, Tag } from 'antd';
import { useNavigate } from 'react-router-dom';
import { ChartCard } from '../components/ChartCard';
import { DonutChart } from '../components/charts/DonutChart';
import { MetricTile } from '../components/MetricTile';
import { useDashboardSnapshot, useDashboardTasks, usePortalOrders } from '../hooks/useDashboardData';
import { useFilterStore } from '../store/filters';

export function OverviewPage() {
  const navigate = useNavigate();
  const { data: snapshot, isLoading: snapshotLoading } = useDashboardSnapshot();
  const { data: tasksData, isLoading: tasksLoading } = useDashboardTasks();
  const { data: ordersData, isLoading: ordersLoading } = usePortalOrders();
  const { filters } = useFilterStore();

  const metricsLoading = snapshotLoading || tasksLoading || ordersLoading;

  const tasks = useMemo(() => {
    const base = tasksData.tasks ?? [];
    if (filters.payer) {
      const lowered = filters.payer.toLowerCase();
      return base.filter((task) => task.metadata?.payer?.toLowerCase?.().includes(lowered));
    }
    return base;
  }, [tasksData.tasks, filters.payer]);
  const totalTasks = tasks.length;
  const openTasks = tasks.filter((task) => task.status.toLowerCase() !== 'closed').length;
  const filteredOrders = useMemo(() => {
    const base = ordersData.orders ?? [];
    if (filters.deviceCategory) {
      const lowered = filters.deviceCategory.toLowerCase();
      return base.filter((order) => order.order_id?.toLowerCase?.().includes(lowered));
    }
    return base;
  }, [ordersData.orders, filters.deviceCategory]);
  const approvals = filteredOrders.filter((order) => order.status === 'approved').length;
  const automationCoverage = computeAutomationCoverage(snapshot, filters.deviceCategory);

  const queueData = buildQueueData(tasks);
  const complianceData = buildComplianceData(snapshot, filters.deviceCategory);

  return (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <MetricTile
            label="Active tasks"
            value={openTasks}
            description={`${totalTasks} total`}
            trend="↑ refreshed in real-time"
            loading={metricsLoading}
          />
        </Col>
        <Col xs={24} md={8}>
          <MetricTile
            label="AI approved orders"
            value={approvals}
            description="Past 7 days"
            loading={metricsLoading}
          />
        </Col>
        <Col xs={24} md={8}>
          <MetricTile
            label="Automation coverage"
            value={automationCoverage}
            description="Workflows monitored"
            loading={metricsLoading}
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <ChartCard
            title="Unified queue status"
            subTitle="Distribution of open, in-progress, and closed work."
            extra={
              <Tag color="blue" style={{ borderRadius: 999 }}>
                Operations
              </Tag>
            }
            loading={metricsLoading}
            footer={
              <Typography.Link onClick={() => navigate('/ops')}>Go to Ops →</Typography.Link>
            }
          >
            <DonutChart data={queueData} onSliceClick={() => navigate('/ops')} />
          </ChartCard>
        </Col>
        <Col xs={24} lg={12}>
          <ChartCard
            title="Compliance readiness"
            subTitle="Hold vs clear vs unknown compliance status across patient work orders."
            extra={
              <Tag color="orange" style={{ borderRadius: 999 }}>
                Compliance
              </Tag>
            }
            loading={metricsLoading}
            footer={
              <Typography.Link onClick={() => navigate('/inventory')}>
                Go to Inventory →
              </Typography.Link>
            }
          >
            <DonutChart data={complianceData} onSliceClick={() => navigate('/inventory')} />
          </ChartCard>
        </Col>
      </Row>
    </Space>
  );
}

function buildQueueData(tasks: import('@gr/api').TaskItem[]) {
  const counts = { Open: 0, 'In Progress': 0, Closed: 0 };
  tasks.forEach((task) => {
    const status = task.status.toLowerCase();
    if (status === 'closed') {
      counts.Closed += 1;
    } else if (status === 'in_progress' || status === 'in progress') {
      counts['In Progress'] += 1;
    } else {
      counts.Open += 1;
    }
  });
  return Object.entries(counts).map(([label, value]) => ({ label, value }));
}

function buildComplianceData(snapshot?: import('@gr/api').DashboardSnapshot, deviceFilter?: string | null) {
  const orders = Array.isArray(snapshot?.ordering?.patient_work_orders)
    ? (snapshot?.ordering?.patient_work_orders as any[])
    : [];
  const filtered = deviceFilter
    ? orders.filter((order) => String(order?.supply_sku || '').toLowerCase().includes(deviceFilter.toLowerCase()))
    : orders;
  const counts: Record<string, number> = { Clear: 0, Hold: 0, Unknown: 0 };
  filtered.forEach((order) => {
    const status = String(order?.compliance_status || 'unknown').toLowerCase();
    if (status === 'clear') {
      counts.Clear += 1;
    } else if (status === 'hold') {
      counts.Hold += 1;
    } else {
      counts.Unknown += 1;
    }
  });
  return Object.entries(counts).map(([label, value]) => ({ label, value }));
}

function computeAutomationCoverage(snapshot?: import('@gr/api').DashboardSnapshot, deviceFilter?: string | null) {
  const orders = Array.isArray(snapshot?.ordering?.patient_work_orders)
    ? (snapshot?.ordering?.patient_work_orders as any[])
    : [];
  const filtered = deviceFilter
    ? orders.filter((order) =>
        String(order?.supply_sku || '').toLowerCase().includes(deviceFilter.toLowerCase())
      )
    : orders;
  if (!filtered.length) return '—';
  const clear = filtered.filter(
    (order) => String(order?.compliance_status || '').toLowerCase() === 'clear'
  ).length;
  return `${Math.round((clear / filtered.length) * 100)}%`;
}
