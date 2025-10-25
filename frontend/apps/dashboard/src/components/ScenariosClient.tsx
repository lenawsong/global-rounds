'use client';

import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { createApiClient } from '../lib/api';
import { Badge, Button, Card, CardBody, CardSubtle, CardTitle, Shell } from '@gr/ui';
import { VegaChart, Specs } from '@gr/charts';

const api = createApiClient();

export function ScenariosClient() {
  const [growth, setGrowth] = useState(15);
  const [lead, setLead] = useState(4);
  const [skus, setSkus] = useState<string[]>([]);

  const mutation = useMutation({
    mutationFn: () => api.runInventoryScenario({ growth_percent: growth, lead_time_delta: lead, skus }),
  });

  const deltas = mutation.data?.deltas || {};
  const chartData = Object.entries(deltas).map(([sku, metrics]) => ({ label: sku, value: metrics.forecast_units || 0 }));

  return (
    <Shell
      title="Scenario Planning"
      description="Model demand surges or supplier delays, then quantify the SKU action mix against today’s baseline."
      primaryAction={<Button onClick={() => mutation.mutate()} disabled={mutation.isLoading}>Run scenario</Button>}
      tabs={[
        { key: 'overview', label: 'Overview', href: '/' },
        { key: 'ops', label: 'Ops', href: '/ops' },
        { key: 'finance', label: 'Finance', href: '/finance' },
        { key: 'inventory', label: 'Inventory', href: '/inventory' },
        { key: 'engagement', label: 'Engagement', href: '/engagement' },
        { key: 'scenarios', label: 'Scenarios', href: '/scenarios' }
      ]}
      activeTab="scenarios"
    >
      <section className="grid gap-6 lg:grid-cols-[400px_1fr]">
        <Card>
          <CardTitle>Scenario inputs</CardTitle>
          <CardSubtle>Tweak growth and supply constraints, optionally focusing on critical SKUs.</CardSubtle>
          <CardBody>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                mutation.mutate();
              }}
            >
              <label className="flex flex-col gap-2 text-sm text-slate-600">
                Demand growth (%)
                <input
                  className="rounded-lg border border-slate-200 px-3 py-2"
                  type="number"
                  value={growth}
                  onChange={(event) => setGrowth(Number(event.target.value))}
                />
              </label>
              <label className="flex flex-col gap-2 text-sm text-slate-600">
                Lead time delta (days)
                <input
                  className="rounded-lg border border-slate-200 px-3 py-2"
                  type="number"
                  value={lead}
                  onChange={(event) => setLead(Number(event.target.value))}
                />
              </label>
              <label className="flex flex-col gap-2 text-sm text-slate-600">
                Focus SKUs
                <input
                  className="rounded-lg border border-slate-200 px-3 py-2"
                  placeholder="INC-XL-24, OXY-CONS-5L"
                  value={skus.join(', ')}
                  onChange={(event) => setSkus(event.target.value.split(',').map((sku) => sku.trim()).filter(Boolean))}
                />
              </label>
              <div className="flex gap-3">
                <Button type="submit" disabled={mutation.isLoading}>
                  {mutation.isLoading ? 'Running…' : 'Run scenario'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setGrowth(15);
                    setLead(4);
                    setSkus([]);
                  }}
                >
                  Reset
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
        <Card>
          <CardTitle>Scenario delta</CardTitle>
          <CardSubtle>Forecasted units delta vs. baseline for highlighted SKUs.</CardSubtle>
          <CardBody>
            {mutation.isLoading ? (
              <p className="text-sm text-slate-500">Running scenario…</p>
            ) : mutation.isError ? (
              <p className="text-sm text-rose-500">Scenario failed. Please retry.</p>
            ) : chartData.length ? (
              <VegaChart spec={Specs.horizontalBarSpec()} data={{ table: chartData }} />
            ) : (
              <p className="text-sm text-slate-400">Run a scenario to visualize projected changes.</p>
            )}
          </CardBody>
        </Card>
      </section>

      <section className="grid gap-6">
        {chartData.length ? (
          <Card>
            <CardTitle>Detailed deltas</CardTitle>
            <CardSubtle>Sorted by impact.</CardSubtle>
            <CardBody>
              <div className="overflow-hidden rounded-2xl border border-slate-200/70">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 text-left">SKU</th>
                      <th className="px-4 py-3 text-left">Δ Forecast units</th>
                      <th className="px-4 py-3 text-left">Δ Buffer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {Object.entries(deltas).map(([sku, metrics]) => (
                      <tr key={sku} className="hover:bg-slate-50/60">
                        <td className="px-4 py-3 font-medium text-slate-900">{sku}</td>
                        <td className="px-4 py-3 text-slate-600">{metrics.forecast_units?.toFixed?.(1) ?? metrics.forecast_units}</td>
                        <td className="px-4 py-3 text-slate-600">{metrics.recommended_buffer?.toFixed?.(1) ?? metrics.recommended_buffer}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        ) : null}
      </section>
    </Shell>
  );
}
