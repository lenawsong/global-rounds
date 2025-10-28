import { useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Row,
  Col,
  Typography,
  Space,
  Form,
  Input,
  InputNumber,
  Button,
  message,
  Tag
} from 'antd';
import { ChartCard } from '../components/ChartCard';
import { HorizontalBarChart } from '../components/charts/HorizontalBarChart';
import { S2Table, S2Column } from '../components/tables/S2Table';
import { useDashboardSnapshot } from '../hooks/useDashboardData';
import { createApiClient } from '../lib/api';
import { useFilterStore } from '../store/filters';

const api = createApiClient();

type ScenarioInputs = {
  growth_percent: number;
  lead_time_delta: number;
  skus: string[];
};

const scenarioDefaults = {
  growth_percent: 10,
  lead_time_delta: 2,
  skus: 'INC-XL-24, CATH-LEG-1L'
};

function coerceNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback;
  }
  if (typeof value === 'string' && value.trim().length === 0) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isFiniteNumber(value: unknown): boolean {
  if (typeof value === 'number') {
    return Number.isFinite(value);
  }
  if (value === null || value === undefined) {
    return false;
  }
  return Number.isFinite(Number(value));
}

export function InventoryPage() {
  const [form] = Form.useForm();
  const { data: snapshot, isLoading } = useDashboardSnapshot();
  const { filters } = useFilterStore();

  const workOrders = useMemo(() => {
    const base = Array.isArray(snapshot?.ordering?.patient_work_orders)
      ? (snapshot?.ordering?.patient_work_orders as any[])
      : [];
    if (filters.deviceCategory) {
      const lowered = filters.deviceCategory.toLowerCase();
      return base.filter((order) => String(order?.supply_sku || '').toLowerCase().includes(lowered));
    }
    return base;
  }, [snapshot, filters.deviceCategory]);

  const vendor = useMemo(() => {
    const base = Array.isArray(snapshot?.ordering?.vendor_reorders)
      ? (snapshot?.ordering?.vendor_reorders as any[])
      : [];
    if (filters.deviceCategory) {
      const lowered = filters.deviceCategory.toLowerCase();
      return base.filter((row) => String(row?.supply_sku || '').toLowerCase().includes(lowered));
    }
    return base;
  }, [snapshot, filters.deviceCategory]);

  const forecast = useMemo(
    () => normalizeForecast(snapshot?.inventory_forecast, filters.deviceCategory),
    [snapshot, filters.deviceCategory]
  );
  const workOrderMix = useMemo(() => buildWorkOrderBars(workOrders), [workOrders]);

  const vendorColumns: S2Column[] = [
    { field: 'supply_sku', title: 'SKU', width: 160 },
    { field: 'suggested_order_qty', title: 'Suggested qty', width: 140 },
    { field: 'rationale', title: 'Rationale', width: 260 }
  ];

  const vendorRows = vendor.map((item) => ({
    supply_sku: item.supply_sku,
    suggested_order_qty: item.suggested_order_qty,
    rationale: item.rationale
  }));

  const scenarioMutation = useMutation({
    mutationFn: (inputs: ScenarioInputs) => api.runInventoryScenario(inputs),
    onSuccess: () => message.success('Scenario run complete'),
    onError: () => message.error('Scenario failed. Try again.')
  });

  const scenarioData = scenarioMutation.data?.deltas ?? {};
  const scenarioRows = Object.entries(scenarioData).map(([sku, metrics]) => {
    const detail = metrics as Record<string, unknown>;
    const delta = coerceNumber(detail?.forecast_units);
    const serviceLevel = isFiniteNumber(detail?.service_level)
      ? coerceNumber(detail?.service_level)
      : null;
    return {
      sku,
      delta,
      service_level: serviceLevel
    };
  });

  return (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <ChartCard
            title="Patient work orders"
            subTitle="Upcoming fulfillment backlog by compliance state."
            loading={isLoading}
            extra={<Tag color="blue">Backlog</Tag>}
            footer={
              <Typography.Text type="secondary">
                {workOrders.length} work orders identified; {workOrders.filter((o) => o.compliance_status === 'hold').length} on hold pending documentation.
              </Typography.Text>
            }
          >
            <HorizontalBarChart data={workOrderMix} />
          </ChartCard>
        </Col>
        <Col xs={24} lg={12}>
          <ChartCard
            title="Vendor recommendations"
            subTitle="Suggested reorder quantities for critical SKUs."
            loading={isLoading}
          >
            <S2Table data={vendorRows} columns={vendorColumns} height={320} />
          </ChartCard>
        </Col>
      </Row>

      <ChartCard
        title="Inventory forecast"
        subTitle="SKU actions derived from predictive inventory model."
        loading={isLoading}
      >
        <HorizontalBarChart data={forecast} />
      </ChartCard>

      <ChartCard
        title="Scenario planner"
        subTitle="Stress test growth and lead-time assumptions before confirming purchase orders."
        extra={
          <Space>
            <Button type="primary" onClick={() => form.submit()} loading={scenarioMutation.isLoading}>
              Run scenario
            </Button>
            <Button
              onClick={() => {
                form.setFieldsValue(scenarioDefaults);
                scenarioMutation.reset();
              }}
            >
              Reset
            </Button>
          </Space>
        }
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={scenarioDefaults}
          onFinish={(values) => {
            const payload: ScenarioInputs = {
              growth_percent: values.growth_percent,
              lead_time_delta: values.lead_time_delta,
              skus: values.skus
                .split(',')
                .map((sku: string) => sku.trim())
                .filter(Boolean)
            };
            scenarioMutation.mutate(payload);
          }}
        >
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item label="Demand growth %" name="growth_percent" rules={[{ required: true }]}>
                <InputNumber min={-50} max={250} className="w-full" addonAfter="%" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="Lead time delta (days)" name="lead_time_delta" rules={[{ required: true }]}>
                <InputNumber min={-14} max={60} className="w-full" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                label="Focus SKUs"
                name="skus"
                tooltip="Comma separate SKUs to prioritize in the scenario."
              >
                <Input placeholder="INC-XL-24, CATH-LEG-1L" />
              </Form.Item>
            </Col>
          </Row>
        </Form>

        <Space direction="vertical" size={16} style={{ width: '100%', marginTop: 16 }}>
          <Typography.Text strong>Scenario impact</Typography.Text>
          {scenarioRows.length ? (
            <HorizontalBarChart
              data={scenarioRows.map((row) => ({
                label: row.sku,
                value: Number(coerceNumber(row.delta).toFixed(2))
              }))}
            />
          ) : (
            <Typography.Text type="secondary">Run a scenario to see projected deltas.</Typography.Text>
          )}
          <S2Table
            data={scenarioRows.map((row) => ({
              sku: row.sku,
              delta_units: coerceNumber(row.delta).toFixed(1),
              service_level:
                row.service_level !== null
                  ? `${(coerceNumber(row.service_level) * 100).toFixed(1)}%`
                  : '—'
            }))}
            columns={[
              { field: 'sku', title: 'SKU', width: 160 },
              { field: 'delta_units', title: 'Δ Forecast units', width: 160 },
              { field: 'service_level', title: 'Δ Service level', width: 160 }
            ]}
            height={260}
          />
        </Space>
      </ChartCard>
    </Space>
  );
}

function buildWorkOrderBars(workOrders: any[]) {
  const counts: Record<string, number> = {};
  workOrders.forEach((order) => {
    const status = String(order?.compliance_status || 'clear').toLowerCase();
    counts[status] = (counts[status] || 0) + 1;
  });
  return Object.entries(counts).map(([label, value]) => ({
    label: capitalize(label),
    value
  }));
}

function normalizeForecast(forecast: any, deviceFilter?: string | null) {
  if (!forecast || typeof forecast !== 'object') return [];
  const entries = Object.entries(forecast).filter(([sku]) =>
    deviceFilter ? sku.toLowerCase().includes(deviceFilter.toLowerCase()) : true
  );
  return entries
    .map(([sku, detail]) => ({
      label: sku,
      value: Number((detail as any)?.forecast_units || 0)
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);
}

function capitalize(value: string) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}
