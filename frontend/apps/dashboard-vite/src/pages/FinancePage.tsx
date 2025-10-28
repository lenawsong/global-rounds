import { useMemo, useState } from 'react';
import { Row, Col, Typography, Space, Select, Button } from 'antd';
import { useDashboardSnapshot } from '../hooks/useDashboardData';
import { ChartCard } from '../components/ChartCard';
import { HistogramChart } from '../components/charts/HistogramChart';
import { ParetoChart } from '../components/charts/ParetoChart';
import { S2Table, S2Column } from '../components/tables/S2Table';
import { createApiClient } from '../lib/api';
import { useFilterStore } from '../store/filters';

const api = createApiClient();

export function FinancePage() {
  const { data: snapshot, isLoading } = useDashboardSnapshot();
  const { filters } = useFilterStore();
  const underpayments = useMemo(() => {
    const base = Array.isArray(snapshot?.payments?.underpayments)
      ? (snapshot?.payments?.underpayments as any[])
      : [];
    if (filters.payer) {
      const lowered = filters.payer.toLowerCase();
      return base.filter((item) => item.payer?.toLowerCase?.().includes(lowered));
    }
    return base;
  }, [snapshot, filters.payer]);
  const documentation = useMemo(() => {
    const base = Array.isArray(snapshot?.payments?.documentation_queue)
      ? (snapshot?.payments?.documentation_queue as any[])
      : [];
    if (filters.payer) {
      const lowered = filters.payer.toLowerCase();
      return base.filter((item) => item.payer?.toLowerCase?.().includes(lowered));
    }
    return base;
  }, [snapshot, filters.payer]);

  const varianceData = useMemo(() => buildVarianceHistogram(underpayments), [underpayments]);
  const paretoData = useMemo(() => buildDenialPareto(documentation), [documentation]);

  const payers = useMemo(
    () => Array.from(new Set(documentation.map((row) => row.payer))).filter(Boolean),
    [documentation]
  );
  const denialCodes = useMemo(
    () => Array.from(new Set(documentation.map((row) => row.denial_code))).filter(Boolean),
    [documentation]
  );

  const [payerFilter, setPayerFilter] = useState<string | null>(null);
  const [codeFilter, setCodeFilter] = useState<string | null>(null);

  const tableData = useMemo(() => {
    return documentation
      .filter((item) => (payerFilter ? item.payer === payerFilter : true))
      .filter((item) => (codeFilter ? item.denial_code === codeFilter : true))
      .filter((item) => withinDateRange(item.received_at, filters.dateRange))
      .map((item) => ({
        claim_id: item.claim_id,
        payer: item.payer,
        denial_code: item.denial_code,
        requested_docs: item.requested_docs,
        status: capitalize(item.status),
        received_at: formatDate(item.received_at)
      }));
  }, [documentation, payerFilter, codeFilter, filters.dateRange]);

  const columns: S2Column[] = [
    { field: 'claim_id', title: 'Claim ID', width: 160 },
    { field: 'payer', title: 'Payer', width: 200 },
    { field: 'denial_code', title: 'Denial code', width: 140 },
    { field: 'requested_docs', title: 'Requested docs', width: 220 },
    { field: 'status', title: 'Status', width: 160 },
    { field: 'received_at', title: 'Received', width: 160 }
  ];

  return (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <ChartCard
            title="Variance distribution"
            subTitle="Underpayment buckets by variance amount."
            loading={isLoading}
            extra={
              <Button onClick={() => api.runAgents(['finance'])} type="link">
                Run finance agent
              </Button>
            }
            footer={
              <Typography.Text type="secondary">
                Focus on the highest variance buckets first to accelerate recovery.
              </Typography.Text>
            }
          >
            <HistogramChart data={varianceData} annotations={buildVarianceAnnotations(varianceData)} />
          </ChartCard>
        </Col>
        <Col xs={24} lg={12}>
          <ChartCard
            title="Denial Pareto"
            subTitle="Denial codes sorted by frequency with cumulative share."
            loading={isLoading}
          >
            <ParetoChart data={paretoData} />
          </ChartCard>
        </Col>
      </Row>

      <ChartCard
        title="Documentation queue"
        subTitle="Payers requesting additional documentation."
        loading={isLoading}
        extra={
          <Space>
            <Select
              allowClear
              placeholder="Filter by payer"
              value={payerFilter ?? undefined}
              style={{ width: 200 }}
              options={payers.map((payer) => ({ value: payer, label: payer }))}
              onChange={(value) => setPayerFilter(value ?? null)}
            />
            <Select
              allowClear
              placeholder="Filter by denial code"
              value={codeFilter ?? undefined}
              style={{ width: 200 }}
              options={denialCodes.map((code) => ({ value: code, label: code }))}
              onChange={(value) => setCodeFilter(value ?? null)}
            />
          </Space>
        }
      >
        <S2Table data={tableData} columns={columns} height={420} />
      </ChartCard>
    </Space>
  );
}

function withinDateRange(value?: string, range?: [string, string]) {
  if (!range || !range[0] || !range[1]) return true;
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  const start = new Date(range[0]).getTime();
  const end = new Date(range[1]).getTime();
  return timestamp >= start && timestamp <= end;
}

function buildVarianceHistogram(underpayments: any[]) {
  const buckets = [
    { label: '0-50', min: 0, max: 50 },
    { label: '50-100', min: 50, max: 100 },
    { label: '100-250', min: 100, max: 250 },
    { label: '250-500', min: 250, max: 500 },
    { label: '500+', min: 500, max: Number.POSITIVE_INFINITY }
  ];
  const counts = buckets.map(() => 0);
  underpayments.forEach((entry) => {
    const variance = Number(String(entry?.variance || '0').replace(/[$,]/g, '')) || 0;
    const bucketIndex = buckets.findIndex((bucket) => variance >= bucket.min && variance < bucket.max);
    const index = bucketIndex >= 0 ? bucketIndex : buckets.length - 1;
    counts[index] += 1;
  });
  return buckets.map((bucket, index) => ({
    label: bucket.label,
    value: counts[index]
  }));
}

function buildVarianceAnnotations(data: { label: string; value: number }[]) {
  if (!data.length) return [];
  const top = data.reduce((prev, curr) => (curr.value > prev.value ? curr : prev));
  const index = data.findIndex((item) => item.label === top.label);
  return [
    {
      type: 'line',
      value: index,
      text: `Top bucket: ${top.label}`
    }
  ];
}

function buildDenialPareto(documentation: any[]) {
  const counts: Record<string, number> = {};
  documentation.forEach((item) => {
    const code = String(item?.denial_code || 'UNK');
    counts[code] = (counts[code] || 0) + 1;
  });
  return Object.entries(counts)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);
}

function formatDate(value?: string) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
}

function capitalize(value: string) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}
