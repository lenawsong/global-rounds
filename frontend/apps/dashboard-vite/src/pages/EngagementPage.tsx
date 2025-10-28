import { useMemo } from 'react';
import { Card, List, Space, Tag, Typography } from 'antd';
import { useDashboardSnapshot } from '../hooks/useDashboardData';
import { RadialProgress } from '../components/charts/RadialProgress';

const KEYWORD_HIGHLIGHTS = ['urgent', 'denial', 'escalate', 'hold', 'missing', 'delay'];

export function EngagementPage() {
  const { data: snapshot, isLoading } = useDashboardSnapshot();
  const messages = Array.isArray(snapshot?.engagement?.messages)
    ? (snapshot?.engagement?.messages as any[])
    : [];

  const totals = useMemo(() => computeChannelTotals(messages), [messages]);
  const totalCount = totals.sms + totals.email + totals.voice || 1;

  return (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      <Space size={16} wrap>
        <ChannelCard
          label="SMS"
          count={totals.sms}
          total={totalCount}
          color="#2563eb"
          loading={isLoading}
        />
        <ChannelCard
          label="Email"
          count={totals.email}
          total={totalCount}
          color="#9333ea"
          loading={isLoading}
        />
        <ChannelCard
          label="Voice"
          count={totals.voice}
          total={totalCount}
          color="#f97316"
          loading={isLoading}
        />
      </Space>

      <Card
        title="Escalation feed"
        loading={isLoading}
        styles={{ body: { padding: 0 } }}
        extra={<Typography.Text type="secondary">{messages.length} messages</Typography.Text>}
        style={{ borderRadius: 16, boxShadow: '0 18px 48px -28px rgba(15,23,42,0.35)' }}
      >
        <List
          dataSource={messages.slice(0, 12)}
          renderItem={(message) => (
            <List.Item style={{ padding: '16px 20px' }}>
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <Space align="center" style={{ justifyContent: 'space-between' }}>
                  <Tag color={channelColor(message.channel)}>{String(message.channel || '').toUpperCase()}</Tag>
                  <Typography.Text type="secondary">{formatDate(message.timestamp)}</Typography.Text>
                </Space>
                <Typography.Text>{highlightKeywords(message.message)}</Typography.Text>
                <Typography.Link>Order {message.order_id || '—'}</Typography.Link>
              </Space>
            </List.Item>
          )}
          locale={{ emptyText: 'No escalations detected.' }}
        />
      </Card>
    </Space>
  );
}

function ChannelCard({
  label,
  count,
  total,
  color,
  loading
}: {
  label: string;
  count: number;
  total: number;
  color: string;
  loading: boolean;
}) {
  return (
    <Card
      loading={loading}
      style={{
        width: 240,
        borderRadius: 16,
        boxShadow: '0 18px 48px -28px rgba(15,23,42,0.35)'
      }}
    >
      <Space direction="vertical" size={12} style={{ width: '100%', alignItems: 'center' }}>
        <RadialProgress progress={count / total} label={label} color={color} />
        <Typography.Text type="secondary">{count} messages last 24h</Typography.Text>
      </Space>
    </Card>
  );
}

function computeChannelTotals(messages: any[]) {
  return messages.reduce(
    (acc, message) => {
      const channel = String(message.channel || '').toLowerCase();
      if (channel === 'sms') acc.sms += 1;
      else if (channel === 'email') acc.email += 1;
      else if (channel === 'voice') acc.voice += 1;
      return acc;
    },
    { sms: 0, email: 0, voice: 0 }
  );
}

function channelColor(channel: string) {
  const normalized = String(channel || '').toLowerCase();
  if (normalized === 'sms') return 'blue';
  if (normalized === 'email') return 'purple';
  if (normalized === 'voice') return 'orange';
  return 'default';
}

function formatDate(value?: string) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function highlightKeywords(text: string) {
  if (!text) return text;
  let highlighted = text;
  KEYWORD_HIGHLIGHTS.forEach((keyword) => {
    const regex = new RegExp(`(${keyword})`, 'ig');
    highlighted = highlighted.replace(
      regex,
      '<span style="background: rgba(37,99,235,0.12); padding: 0 4px; border-radius: 4px;">$1</span>'
    );
  });
  return <span dangerouslySetInnerHTML={{ __html: highlighted }} />;
}
