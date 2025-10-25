'use client';

import { Badge, Button, Card, CardBody, CardSubtle, CardTitle, Shell } from '@gr/ui';
import { HorizontalBarChart, DualAxesPareto } from '@gr/charts-antv';
import { useDashboardSnapshot } from '../hooks/useDashboardData';
import { createApiClient } from '../lib/api';

const api = createApiClient();

export function FinanceClient() {
  const { data: snapshot } = useDashboardSnapshot();
  const underpayments = Array.isArray(snapshot?.payments?.underpayments)
    ? (snapshot?.payments?.underpayments as any[])
    : [];
  const documentation = Array.isArray(snapshot?.payments?.documentation_queue)
    ? (snapshot?.payments?.documentation_queue as any[])
    : [];

  const variance = buildVariance(underpayments);
  const denialPareto = buildDenialPareto(documentation);

  return (
    <Shell
      title="Finance Insights"
      description="Revenue integrity pulse across underpayments, denials, and documentation queues."
      primaryAction={<Button onClick={() => api.runAgents(['finance'])}>Run finance agent</Button>}
      tabs={[
        { key: 'overview', label: 'Overview', href: '/' },
        { key: 'ops', label: 'Ops', href: '/ops' },
        { key: 'finance', label: 'Finance', href: '/finance' },
        { key: 'inventory', label: 'Inventory', href: '/inventory' },
        { key: 'engagement', label: 'Engagement', href: '/engagement' },
        { key: 'scenarios', label: 'Scenarios', href: '/scenarios' }
      ]}
      activeTab="finance"
    >
      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardTitle>Variance distribution</CardTitle>
          <CardSubtle>Underpayments buckets ($0-50, $50-100, etc.).</CardSubtle>
          <CardBody>
            <div className="grid gap-6 md:grid-cols-[260px_1fr]">
              <div className="space-y-3 text-sm text-slate-600">
                <Badge variant="danger">Underpayments</Badge>
                <p>{underpayments.length} claims with outstanding balances. Focus on the highest bucket first.</p>
              </div>
              <HorizontalBarChart data={variance} />
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardTitle>Denial Pareto</CardTitle>
          <CardSubtle>Denial codes sorted by frequency in the documentation queue.</CardSubtle>
          <CardBody>
            <div className="grid gap-6 md:grid-cols-[260px_1fr]">
              <div className="space-y-3 text-sm text-slate-600">
                <Badge variant="warning">Denied</Badge>
                <p>
                  {(denialPareto[0]?.value ?? 0)} cases tied to {denialPareto[0]?.label || '—'}. Addressing the top three
                  codes clears {topShare(denialPareto)} of backlog volume.
                </p>
              </div>
              <DualAxesPareto data={denialPareto} />
            </div>
          </CardBody>
        </Card>
      </section>

      <section className="grid gap-6">
        <Card>
          <CardTitle>Documentation queue</CardTitle>
          <CardSubtle>Payers requesting additional documentation.</CardSubtle>
          <CardBody>
            <div className="overflow-hidden rounded-2xl border border-slate-200/70">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Claim</th>
                    <th className="px-4 py-3 text-left">Payer</th>
                    <th className="px-4 py-3 text-left">Denial code</th>
                    <th className="px-4 py-3 text-left">Requested docs</th>
                    <th className="px-4 py-3 text-left">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {documentation.slice(0, 8).map((item) => (
                    <tr key={`${item.claim_id}-${item.denial_code}`} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-medium text-slate-900">{item.claim_id}</td>
                      <td className="px-4 py-3 text-slate-600">{item.payer}</td>
                      <td className="px-4 py-3 text-slate-600">{item.denial_code}</td>
                      <td className="px-4 py-3 text-slate-500">{item.requested_docs}</td>
                      <td className="px-4 py-3 text-slate-500 capitalize">{item.status}</td>
                    </tr>
                  ))}
                  {!documentation.length ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                        All documentation requests are satisfied.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      </section>
    </Shell>
  );
}

function buildVariance(underpayments: any[]) {
  const buckets = [0, 50, 100, 250, 500];
  const labels = ['0-50', '50-100', '100-250', '250-500', '500+'];
  const counts = [0, 0, 0, 0, 0];
  underpayments.forEach((entry) => {
    const value = Number(String(entry?.variance || '0').replace(/[$,]/g, '')) || 0;
    if (value <= 50) counts[0] += 1;
    else if (value <= 100) counts[1] += 1;
    else if (value <= 250) counts[2] += 1;
    else if (value <= 500) counts[3] += 1;
    else counts[4] += 1;
  });
  return labels.map((label, idx) => ({ label, value: counts[idx] }));
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

function topShare(data: { value: number }[]) {
  if (!data.length) return '0%';
  const total = data.reduce((acc, item) => acc + item.value, 0) || 1;
  const top = data.slice(0, 3).reduce((acc, item) => acc + item.value, 0);
  return `${Math.round((top / total) * 100)}%`;
}
