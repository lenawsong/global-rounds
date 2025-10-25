'use client';

import * as React from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { createApiClient } from '../lib/api';
import { Badge, Button, Card, CardBody, CardSubtle, CardTitle, Shell } from '@gr/ui';

const api = createApiClient();

const AGENTS = ['ordering', 'payments', 'workforce', 'engagement', 'performance', 'finance'] as const;

export function AgentsClient() {
  const { data: statuses, refetch } = useQuery({ queryKey: ['agent-status'], queryFn: () => api.listAgentStatus() });
  const runAll = useMutation({
    mutationFn: () => api.runAgents(),
    onSuccess: () => refetch()
  });
  const runOne = useMutation({
    mutationFn: (agent: string) => api.runAgents([agent]),
    onSuccess: () => refetch()
  });

  return (
    <Shell
      title="Agent Control Center"
      description="Run automation agents and inspect their latest status."
      primaryAction={<Button onClick={() => runAll.mutate()} disabled={runAll.isLoading}>{runAll.isLoading ? 'Running…' : 'Run all'}</Button>}
      tabs={[
        { key: 'overview', label: 'Overview', href: '/' },
        { key: 'ops', label: 'Ops', href: '/ops' },
        { key: 'finance', label: 'Finance', href: '/finance' },
        { key: 'inventory', label: 'Inventory', href: '/inventory' },
        { key: 'engagement', label: 'Engagement', href: '/engagement' },
        { key: 'scenarios', label: 'Scenarios', href: '/scenarios' },
        { key: 'agents', label: 'Agents', href: '/agents' }
      ]}
      activeTab="agents"
    >
      <section className="grid gap-6">
        <Card>
          <CardTitle>Run specific agents</CardTitle>
          <CardSubtle>Kick off a single capability to refresh a module.</CardSubtle>
          <CardBody>
            <div className="flex flex-wrap gap-3">
              {AGENTS.map((a) => (
                <Button key={a} variant="secondary" onClick={() => runOne.mutate(a)} disabled={runOne.isLoading}>{a}</Button>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardTitle>Status</CardTitle>
          <CardSubtle>Last run records by agent.</CardSubtle>
          <CardBody>
            <div className="overflow-hidden rounded-2xl border border-slate-200/70">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Agent</th>
                    <th className="px-4 py-3 text-left">Last Run</th>
                    <th className="px-4 py-3 text-left">Records</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(statuses || []).map((s) => (
                    <tr key={s.agent} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-medium text-slate-900">{s.agent}</td>
                      <td className="px-4 py-3 text-slate-600">{s.last_run ? new Date(s.last_run).toLocaleString() : '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{s.records}</td>
                    </tr>
                  ))}
                  {!statuses?.length ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-slate-400">No status available.</td>
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

