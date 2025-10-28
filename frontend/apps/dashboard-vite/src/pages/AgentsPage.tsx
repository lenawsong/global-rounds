import { useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button, Space, Typography, message } from 'antd';
import { useAgentStatuses } from '../hooks/useDashboardData';
import { createApiClient } from '../lib/api';
import { ChartCard } from '../components/ChartCard';
import { S2Table, S2Column } from '../components/tables/S2Table';

const api = createApiClient();
const AGENTS = ['ordering', 'payments', 'workforce', 'engagement', 'performance', 'finance'];

export function AgentsPage() {
  const { data: statuses, isLoading, refetch } = useAgentStatuses();
  const runAll = useMutation({
    mutationFn: () => api.runAgents(),
    onSuccess: () => {
      message.success('Triggered all agents');
      refetch();
    },
    onError: () => message.error('Failed to trigger agents')
  });

  const runSingle = useMutation({
    mutationFn: (agent: string) => api.runAgents([agent]),
    onSuccess: () => {
      message.success('Agent triggered');
      refetch();
    },
    onError: () => message.error('Failed to run agent')
  });

  const tableColumns: S2Column[] = [
    { field: 'agent', title: 'Agent', width: 200 },
    { field: 'last_run', title: 'Last run', width: 220 },
    { field: 'records', title: 'Records processed', width: 200 }
  ];

  const tableData = useMemo(
    () =>
      statuses?.map((status) => ({
        agent: status.agent,
        last_run: status.last_run ? new Date(status.last_run).toLocaleString() : '—',
        records: status.records ?? 0
      })) ?? [],
    [statuses]
  );

  return (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      <ChartCard
        title="Agent control center"
        subTitle="Run automation agents and inspect their latest status."
        extra={
          <Space>
            <Button
              type="primary"
              onClick={() => runAll.mutate()}
              loading={runAll.isLoading}
            >
              Run all agents
            </Button>
          </Space>
        }
      >
        <Space wrap>
          {AGENTS.map((agent) => (
            <Button
              key={agent}
              onClick={() => runSingle.mutate(agent)}
              loading={runSingle.isLoading}
            >
              {agent}
            </Button>
          ))}
        </Space>
      </ChartCard>

      <ChartCard title="Agent status" subTitle="Last run records by agent." loading={isLoading}>
        <S2Table data={tableData} columns={tableColumns} height={360} />
      </ChartCard>
    </Space>
  );
}
