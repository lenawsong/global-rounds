import { Card, Statistic, Typography } from 'antd';
import type { ReactNode } from 'react';

type MetricTileProps = {
  label: string;
  value: number | string;
  suffix?: ReactNode;
  description?: string;
  trend?: string;
  loading?: boolean;
};

export function MetricTile({ label, value, suffix, description, trend, loading }: MetricTileProps) {
  return (
    <Card
      loading={loading}
      bordered
      style={{
        borderRadius: 16,
        boxShadow: '0 16px 40px -24px rgba(15, 23, 42, 0.3)',
        background: 'linear-gradient(135deg, rgba(255,255,255,0.95), rgba(248,250,252,0.95))'
      }}
      bodyStyle={{ padding: 20 }}
    >
      <Typography.Text type="secondary" style={{ fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase' }}>
        {label}
      </Typography.Text>
      <Statistic value={value} suffix={suffix} valueStyle={{ fontSize: 30, fontWeight: 600, color: '#111827' }} />
      {description ? (
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
          {description}
        </Typography.Paragraph>
      ) : null}
      {trend ? (
        <Typography.Text style={{ color: '#2563eb', fontSize: 12, fontWeight: 500 }}>{trend}</Typography.Text>
      ) : null}
    </Card>
  );
}
