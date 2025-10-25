'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { createApiClient } from '../lib/api';
import { Badge, Button, Card, CardBody, CardSubtle, CardTitle, Shell } from '@gr/ui';
import { HorizontalBarChart } from '@gr/charts-antv';
import * as React from 'react';

const api = createApiClient();

export function InventoryClient() {
  const { data: snapshot } = useQuery({ queryKey: ['dashboard-snapshot'], queryFn: () => api.getDashboardSnapshot() });
  const workOrders = Array.isArray(snapshot?.ordering?.patient_work_orders)
    ? (snapshot?.ordering?.patient_work_orders as any[])
    : [];
  const vendor = Array.isArray(snapshot?.ordering?.vendor_reorders) ? (snapshot?.ordering?.vendor_reorders as any[]) : [];
  const forecast = normalizeForecast(snapshot?.inventory_forecast);

  const [scenarioInputs, setScenarioInputs] = React.useState({ growth_percent: 10, lead_time_delta: 2, skus: [] as string[] });
  const scenarioMutation = useMutation({
    mutationFn: () => api.runInventoryScenario(scenarioInputs),
  });

  const scenarioData = scenarioMutation.data?.deltas || {};

  return (
    <Shell
      title="Inventory Command"
      description="Balance patient demand, warehouse availability, and vendor readiness with predictive intelligence."
      primaryAction={<Button onClick={() => scenarioMutation.mutate()}>Run scenario</Button>}
      tabs={[
        { key: 'overview', label: 'Overview', href: '/' },
        { key: 'ops', label: 'Ops', href: '/ops' },
        { key: 'finance', label: 'Finance', href: '/finance' },
        { key: 'inventory', label: 'Inventory', href: '/inventory' },
        { key: 'engagement', label: 'Engagement', href: '/engagement' },
        { key: 'scenarios', label: 'Scenarios', href: '/scenarios' }
      ]}
      activeTab="inventory"
    >
      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardTitle>Patient work orders</CardTitle>
          <CardSubtle>Upcoming fulfillment backlog by compliance state.</CardSubtle>
          <CardBody>
            <div className="grid gap-6 md:grid-cols-[260px_1fr]">
              <div className="space-y-3 text-sm text-slate-600">
                <Badge variant="brand">Backlog</Badge>
                <p>
                  {workOrders.length} work orders identified. {workOrders.filter((o) => o.compliance_status === 'hold').length}
                  {' '}on hold pending documentation.
                </p>
              </div>
              <HorizontalBarChart data={buildWorkOrderBars(workOrders)} />
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardTitle>Vendor recommendations</CardTitle>
          <CardSubtle>Suggested reorder quantities for critical SKUs.</CardSubtle>
          <CardBody>
            <div className="overflow-hidden rounded-2xl border border-slate-200/70">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left">SKU</th>
                    <th className="px-4 py-3 text-left">Suggested qty</th>
                    <th className="px-4 py-3 text-left">Rationale</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {vendor.slice(0, 8).map((item) => (
                    <tr key={item.supply_sku} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-medium text-slate-900">{item.supply_sku}</td>
                      <td className="px-4 py-3 text-slate-600">{item.suggested_order_qty}</td>
                      <td className="px-4 py-3 text-slate-500">{item.rationale}</td>
                    </tr>
                  ))}
                  {!vendor.length ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-slate-400">
                        No vendor actions required.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      </section>

      <section className="grid gap-6">
        <Card>
          <CardTitle>Inventory forecast</CardTitle>
          <CardSubtle>SKU actions derived from predictive inventory model.</CardSubtle>
          <CardBody>
            <HorizontalBarChart data={forecast} />
          </CardBody>
        </Card>

        <Card>
          <CardTitle>Scenario planning</CardTitle>
          <CardSubtle>Stress test growth and lead-time assumptions before confirming purchase orders.</CardSubtle>
          <CardBody>
            <form
              className="grid gap-4 md:grid-cols-3"
              onSubmit={(event) => {
                event.preventDefault();
                scenarioMutation.mutate();
              }}
            >
              <label className="flex flex-col gap-2 text-sm text-slate-600">
                Demand growth %
                <input
                  className="rounded-lg border border-slate-200 px-3 py-2"
                  type="number"
                  value={scenarioInputs.growth_percent}
                  onChange={(event) => setScenarioInputs((prev) => ({ ...prev, growth_percent: Number(event.target.value) }))}
                />
              </label>
              <label className="flex flex-col gap-2 text-sm text-slate-600">
                Lead time delta (days)
                <input
                  className="rounded-lg border border-slate-200 px-3 py-2"
                  type="number"
                  value={scenarioInputs.lead_time_delta}
                  onChange={(event) => setScenarioInputs((prev) => ({ ...prev, lead_time_delta: Number(event.target.value) }))}
                />
              </label>
              <label className="flex flex-col gap-2 text-sm text-slate-600">
                Focus SKUs (comma separated)
                <input
                  className="rounded-lg border border-slate-200 px-3 py-2"
                  type="text"
                  placeholder="INC-XL-24, CATH-LEG-1L"
                  value={scenarioInputs.skus.join(', ')}
                  onChange={(event) =>
                    setScenarioInputs((prev) => ({ ...prev, skus: event.target.value.split(',').map((sku) => sku.trim()).filter(Boolean) }))
                  }
                />
              </label>
            </form>
            <div className="mt-4">
              {scenarioMutation.isLoading ? (
                <p className="text-sm text-slate-500">Running scenario…</p>
              ) : scenarioMutation.isError ? (
                <p className="text-sm text-rose-500">Scenario failed. Try again.</p>
              ) : scenarioMutation.data ? (
                <ScenarioDeltas deltas={scenarioData} />
              ) : (
                <p className="text-sm text-slate-400">Adjust inputs and run to see SKU deltas.</p>
              )}
            </div>
          </CardBody>
        </Card>
      </section>
    </Shell>
  );
}

function buildWorkOrderBars(workOrders: any[]) {
  const buckets: Record<string, number> = {};
  workOrders.forEach((order) => {
    const compliance = String(order?.compliance_status || 'clear').toLowerCase();
    buckets[compliance] = (buckets[compliance] || 0) + 1;
  });
  return Object.entries(buckets).map(([label, value]) => ({ label, value }));
}

function normalizeForecast(forecast: any): { label: string; value: number }[] {
  if (!forecast || typeof forecast !== 'object') return [];
  return Object.entries(forecast).map(([sku, detail]) => ({
    label: sku,
    value: Number((detail as any)?.forecast_units || 0)
  })).sort((a, b) => b.value - a.value).slice(0, 10);
}

function ScenarioDeltas({ deltas }: { deltas: Record<string, Record<string, number>> }) {
  const entries = Object.entries(deltas).slice(0, 6);
  if (!entries.length) {
    return <p className="text-sm text-slate-500">Scenario produced no deltas for the selected filters.</p>;
  }
  return (
    <div className="grid gap-3 text-sm">
      {entries.map(([sku, metrics]) => (
        <div key={sku} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
          <span className="font-medium text-slate-900">{sku}</span>
          <span className="text-slate-600">Δ {metrics.forecast_units?.toFixed?.(1) ?? metrics.forecast_units}</span>
        </div>
      ))}
    </div>
  );
}
