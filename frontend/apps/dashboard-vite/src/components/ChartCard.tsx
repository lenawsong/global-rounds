import type { ReactNode } from 'react';
import { ProCard } from '@ant-design/pro-components';
import { Skeleton, Space, Typography } from 'antd';

type ChartCardProps = {
  title: string;
  subTitle?: string;
  extra?: ReactNode;
  loading?: boolean;
  children: ReactNode;
  footer?: ReactNode;
};

export function ChartCard({ title, subTitle, extra, loading, children, footer }: ChartCardProps) {
  return (
    <ProCard
      bordered
      headerBordered
      title={
        <Space direction="vertical" size={4}>
          <Typography.Text strong style={{ fontSize: 16 }}>
            {title}
          </Typography.Text>
          {subTitle ? <Typography.Text type="secondary">{subTitle}</Typography.Text> : null}
        </Space>
      }
      extra={extra}
      style={{ borderRadius: 16, boxShadow: '0 24px 60px -30px rgba(15, 23, 42, 0.35)' }}
      bodyStyle={{ padding: 24, background: 'rgba(255, 255, 255, 0.9)' }}
    >
      {loading ? <Skeleton active /> : children}
      {footer ? <div style={{ marginTop: 16 }}>{footer}</div> : null}
    </ProCard>
  );
}
