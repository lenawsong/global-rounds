import { useMemo, useState } from 'react';
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
  Select,
  message,
  Card
} from 'antd';
import { ChartCard } from '../components/ChartCard';
import { HorizontalBarChart } from '../components/charts/HorizontalBarChart';
import { TornadoChart } from '../components/charts/TornadoChart';
import { S2Table, S2Column } from '../components/tables/S2Table';
import { createApiClient } from '../lib/api';

type ScenarioInputs = {
  name: string;
  growth_percent: number;
  lead_time_delta: number;
  skus: string[];
};

type ScenarioRun = {
  name: string;
  inputs: ScenarioInputs;
  deltas: Record<string, { forecast_units?: number; service_level?: number }>;
  timestamp: string;
};

const api = createApiClient();

const defaultInputs = {
  name: 'Baseline stress test',
  growth_percent: 15,
  lead_time_delta: 4,
  skus: 'INC-XL-24, OXY-CONS-5L'
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

export function ScenariosPage() {
  const [form] = Form.useForm();
  const [runs, setRuns] = useState<ScenarioRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (payload: ScenarioInputs) => api.runInventoryScenario(payload),
    onSuccess: (data, variables) => {
      const run: ScenarioRun = {
        name: variables.name,
        inputs: variables,
        deltas: data.deltas ?? {},
        timestamp: new Date().toISOString()
      };
      setRuns((prev) => [run, ...prev.filter((existing) => existing.name !== run.name)]);
      setSelectedRun(run.name);
      message.success(`Scenario "${run.name}" ready`);
    },
    onError: () => message.error('Scenario failed. Try again.')
  });

  const activeRun = useMemo(
    () => runs.find((run) => run.name === selectedRun) ?? runs[0],
    [runs, selectedRun]
  );

  const barData = useMemo(() => {
    if (!activeRun) return [];
    return Object.entries(activeRun.deltas).map(([sku, metrics]) => {
      const forecastUnits = coerceNumber(metrics?.forecast_units);
      return {
        label: sku,
        value: Number(forecastUnits.toFixed(2))
      };
    });
  }, [activeRun]);

  const tornadoData = useMemo(() => buildTornadoData(runs), [runs]);
  const tornadoScenarios = useMemo(() => runs.map((run) => run.name), [runs]);

  const tableColumns: S2Column[] = [
    { field: 'sku', title: 'SKU', width: 160 },
    { field: 'delta_units', title: 'Δ Forecast units', width: 180 },
    { field: 'service_level', title: 'Δ Service level', width: 180 }
  ];

  const tableData = activeRun
    ? Object.entries(activeRun.deltas).map(([sku, metrics]) => ({
        sku,
        delta_units: coerceNumber(metrics.forecast_units).toFixed(2),
        service_level: isFiniteNumber(metrics.service_level)
          ? `${(coerceNumber(metrics.service_level) * 100).toFixed(1)}%`
          : '—'
      }))
    : [];

  return (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      <ChartCard
        title="Scenario inputs"
        subTitle="Model demand surges or supplier delays, then quantify the SKU action mix against today’s baseline."
        extra={
          <Space>
            <Button type="primary" onClick={() => form.submit()} loading={mutation.isLoading}>
              Run scenario
            </Button>
            <Button
              onClick={() => {
                form.setFieldsValue(defaultInputs);
                setSelectedRun(null);
              }}
            >
              Reset
            </Button>
          </Space>
        }
      >
        <Form
          layout="vertical"
          form={form}
          initialValues={defaultInputs}
          onFinish={(values) => {
            const payload: ScenarioInputs = {
              name: values.name,
              growth_percent: values.growth_percent,
              lead_time_delta: values.lead_time_delta,
              skus: values.skus
                .split(',')
                .map((sku: string) => sku.trim())
                .filter(Boolean)
            };
            mutation.mutate(payload);
          }}
        >
          <Row gutter={16}>
            <Col xs={24} md={6}>
              <Form.Item
                label="Scenario name"
                name="name"
                rules={[{ required: true, message: 'Provide a scenario name' }]}
              >
                <Input placeholder="Baseline stress test" />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item
                label="Demand growth %"
                name="growth_percent"
                rules={[{ required: true }]}
              >
                <InputNumber min={-50} max={300} className="w-full" addonAfter="%" />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item
                label="Lead time delta (days)"
                name="lead_time_delta"
                rules={[{ required: true }]}
              >
                <InputNumber min={-21} max={90} className="w-full" />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item label="Focus SKUs" name="skus">
                <Input placeholder="INC-XL-24, OXY-CONS-5L" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </ChartCard>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <ChartCard
            title="Scenario delta"
            subTitle="Forecasted units delta vs baseline for highlighted SKUs."
            extra={
              runs.length ? (
                <Select
                  style={{ width: 220 }}
                  value={activeRun?.name}
                  options={runs.map((run) => ({ value: run.name, label: run.name }))}
                  onChange={setSelectedRun}
                />
              ) : null
            }
          >
            {barData.length ? (
              <HorizontalBarChart data={barData} />
            ) : (
              <Typography.Text type="secondary">
                Run a scenario to visualize projected changes.
              </Typography.Text>
            )}
          </ChartCard>
        </Col>
        <Col xs={24} lg={12}>
          <ChartCard
            title="Sensitivity analysis"
            subTitle="Compare multiple scenario runs for critical SKUs."
          >
            {tornadoData.length ? (
              <TornadoChart data={tornadoData} scenarios={tornadoScenarios} />
            ) : (
              <Typography.Text type="secondary">
                Capture more than one scenario to unlock tornado analysis.
              </Typography.Text>
            )}
          </ChartCard>
        </Col>
      </Row>

      <ChartCard
        title="Scenario details"
        subTitle={activeRun ? `Generated ${new Date(activeRun.timestamp).toLocaleString()}` : ''}
      >
        <S2Table data={tableData} columns={tableColumns} height={360} />
      </ChartCard>

      {!!runs.length && (
        <Card
          title="Scenario history"
          style={{ borderRadius: 16, boxShadow: '0 16px 44px -28px rgba(15,23,42,0.32)' }}
        >
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            {runs.map((run) => (
              <Space
                key={run.name}
                style={{ justifyContent: 'space-between', width: '100%' }}
                align="center"
              >
                <Typography.Text strong>{run.name}</Typography.Text>
                <Typography.Text type="secondary">
                  {new Date(run.timestamp).toLocaleString()}
                </Typography.Text>
              </Space>
            ))}
          </Space>
        </Card>
      )}
    </Space>
  );
}

function buildTornadoData(runs: ScenarioRun[]) {
  if (!runs.length) return [];
  const topSkus = new Set<string>();
  runs.forEach((run) => {
    Object.entries(run.deltas)
      .sort(
        (a, b) =>
          Math.abs(coerceNumber(b[1].forecast_units)) - Math.abs(coerceNumber(a[1].forecast_units))
      )
      .slice(0, 5)
      .forEach(([sku]) => topSkus.add(sku));
  });
  const categories = Array.from(topSkus);
  const data = [];
  for (const run of runs) {
    for (const category of categories) {
      const metric = run.deltas[category];
      if (metric) {
        data.push({
          category,
          scenario: run.name,
          value: Number(coerceNumber(metric.forecast_units).toFixed(2))
        });
      } else {
        data.push({
          category,
          scenario: run.name,
          value: 0
        });
      }
    }
  }
  return data;
}
