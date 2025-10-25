import { useQuery } from '@tanstack/react-query';
import { createApiClient } from '../lib/api';
import snapshotSample from '../sample/dashboard_snapshot.json';
import tasksSample from '../sample/tasks.json';
import ordersSample from '../sample/orders.json';
import agentStatusSample from '../sample/agent_status.json';
import type { DashboardSnapshot, TaskListResponse, PortalOrderListResponse, AgentStatus } from '@gr/api';

const sampleSnapshot = snapshotSample as DashboardSnapshot;
const sampleTasks = tasksSample as TaskListResponse;
const sampleOrders = ordersSample as PortalOrderListResponse;
const sampleAgentStatus = agentStatusSample as AgentStatus[];

const api = createApiClient();

export function useDashboardSnapshot() {
  const query = useQuery({
    queryKey: ['dashboard-snapshot'],
    queryFn: () => api.getDashboardSnapshot(),
    retry: 1
  });
  return { data: query.data ?? sampleSnapshot, isFallback: !!query.error, refetch: query.refetch };
}

export function useDashboardTasks() {
  const query = useQuery({ queryKey: ['tasks'], queryFn: () => api.listTasks(), retry: 1 });
  return { data: query.data ?? sampleTasks, isFallback: !!query.error, refetch: query.refetch };
}

export function usePortalOrders() {
  const query = useQuery({ queryKey: ['portal-orders'], queryFn: () => api.listPortalOrders(), retry: 1 });
  return { data: query.data ?? sampleOrders, isFallback: !!query.error, refetch: query.refetch };
}

export function useAgentStatuses() {
  const query = useQuery({ queryKey: ['agent-status'], queryFn: () => api.listAgentStatus(), retry: 1 });
  return { data: query.data ?? sampleAgentStatus, isFallback: !!query.error, refetch: query.refetch };
}
