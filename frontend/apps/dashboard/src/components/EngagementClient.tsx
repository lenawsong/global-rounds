'use client';

import { Badge, Card, CardBody, CardSubtle, CardTitle, Shell } from '@gr/ui';
import { RoseChart } from '@gr/charts-antv';
import { useDashboardSnapshot } from '../hooks/useDashboardData';

export function EngagementClient() {
  const { data: snapshot } = useDashboardSnapshot();
  const messages = Array.isArray(snapshot?.engagement?.messages) ? (snapshot?.engagement?.messages as any[]) : [];

  const sms = messages.filter((m) => m.channel === 'sms').length;
  const email = messages.filter((m) => m.channel === 'email').length;
  const voice = messages.filter((m) => m.channel === 'voice').length;

  return (
    <Shell
      title="Patient Engagement"
      description="Monitor outreach health, patient replies, and escalation signals across channels."
      tabs={[
        { key: 'overview', label: 'Overview', href: '/' },
        { key: 'ops', label: 'Ops', href: '/ops' },
        { key: 'finance', label: 'Finance', href: '/finance' },
        { key: 'inventory', label: 'Inventory', href: '/inventory' },
        { key: 'engagement', label: 'Engagement', href: '/engagement' },
        { key: 'scenarios', label: 'Scenarios', href: '/scenarios' }
      ]}
      activeTab="engagement"
    >
      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>Channel mix</CardTitle>
          <CardSubtle>SMS, email, and voice touchpoints in the current window.</CardSubtle>
          <CardBody className="overflow-visible">
            <RoseChart data={[{ label: 'SMS', value: sms }, { label: 'Email', value: email }, { label: 'Voice', value: voice }]} />
          </CardBody>
        </Card>
        <Card>
          <CardTitle>Escalation feed</CardTitle>
          <CardSubtle>Latest replies containing keywords that triggered intervention.</CardSubtle>
          <CardBody>
            <div className="space-y-3 text-sm text-slate-600">
              {messages.slice(0, 6).map((message) => (
                <div key={message.id || message.order_id} className="rounded-xl border border-slate-200/70 bg-white/80 p-3">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>{message.channel?.toUpperCase()}</span>
                    <span>{formatDate(message.timestamp)}</span>
                  </div>
                  <p className="mt-2 text-slate-700">{message.message}</p>
                  <Badge variant="brand" className="mt-2">Order {message.order_id || '—'}</Badge>
                </div>
              ))}
              {!messages.length ? <p className="text-slate-400">No escalations detected.</p> : null}
            </div>
          </CardBody>
        </Card>
      </section>
    </Shell>
  );
}

function formatDate(value?: string) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}
