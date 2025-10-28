import { useQuery } from '@tanstack/react-query';
import { createApiClient } from '../lib/api';
import snapshotSample from '../sample/dashboard_snapshot.json';
import tasksSample from '../sample/tasks.json';
import ordersSample from '../sample/orders.json';
import agentStatusSample from '../sample/agent_status.json';
import type { DashboardSnapshot, TaskListResponse, PortalOrderListResponse, AgentStatus } from '@gr/api';

const api = createApiClient();

const sampleSnapshot = snapshotSample as DashboardSnapshot;
const sampleTasks = tasksSample as TaskListResponse;
const sampleOrders = ordersSample as PortalOrderListResponse;
const sampleAgentStatus = agentStatusSample as AgentStatus[];

function isMeaningful(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) {
    return value.some((item) => isMeaningful(item));
  }
  if (typeof value === 'object') {
    const entries = Object.values(value as Record<string, unknown>);
    if (!entries.length) return false;
    return entries.some((entry) => isMeaningful(entry));
  }
  return true;
}

function mergeSection(sampleSection: unknown, liveSection: unknown): unknown {
  if (Array.isArray(liveSection)) {
    return liveSection.length ? liveSection : Array.isArray(sampleSection) ? sampleSection : [];
  }

  if (Array.isArray(sampleSection)) {
    return Array.isArray(liveSection) && liveSection.length ? liveSection : sampleSection;
  }

  if (typeof liveSection === 'object' && liveSection !== null) {
    const liveObj = liveSection as Record<string, unknown>;
    const sampleObj =
      sampleSection && typeof sampleSection === 'object'
        ? (sampleSection as Record<string, unknown>)
        : {};
    const keys = new Set([...Object.keys(sampleObj), ...Object.keys(liveObj)]);
    const merged: Record<string, unknown> = {};
    keys.forEach((key) => {
      merged[key] = mergeSection(sampleObj[key], liveObj[key]);
    });
    return merged;
  }

  if (liveSection === undefined || liveSection === null) {
    return sampleSection;
  }

  if (typeof liveSection === 'string' && liveSection.trim().length === 0) {
    return sampleSection ?? liveSection;
  }

  return liveSection;
}

function mergeSnapshotWithSample(snapshot: DashboardSnapshot | undefined): DashboardSnapshot {
  const live = snapshot ?? {};
  const merged: DashboardSnapshot = { ...(live as DashboardSnapshot) };
  const sampleEntries = sampleSnapshot as Record<string, unknown>;
  Object.entries(sampleEntries).forEach(([key, sampleValue]) => {
    const liveValue = (live as Record<string, unknown>)[key];
    (merged as Record<string, unknown>)[key] = mergeSection(sampleValue, liveValue);
  });
  return merged;
}

function hasTasksData(response: TaskListResponse | undefined): response is TaskListResponse {
  return !!response && Array.isArray(response.tasks) && response.tasks.length > 0;
}

function hasOrdersData(response: PortalOrderListResponse | undefined): response is PortalOrderListResponse {
  return !!response && Array.isArray(response.orders) && response.orders.length > 0;
}

function hasAgentStatusData(statuses: AgentStatus[] | undefined): statuses is AgentStatus[] {
  return !!statuses && statuses.length > 0;
}

export function useDashboardSnapshot(enabled = true) {
  const query = useQuery({
    queryKey: ['dashboard-snapshot'],
    queryFn: () => api.getDashboardSnapshot(),
    retry: 1,
    enabled
  });
  const apiData = query.data;
  const hasData = isMeaningful(apiData);
  const data = mergeSnapshotWithSample(apiData);
  return {
    data,
    isLoading: query.isLoading,
    isError: query.isError,
    isFallback: !!query.error || !hasData,
    refetch: query.refetch
  };
}

export function useDashboardTasks(enabled = true) {
  const query = useQuery({
    queryKey: ['tasks'],
    queryFn: () => api.listTasks(),
    retry: 1,
    enabled
  });
  const apiData = query.data;
  const hasData = hasTasksData(apiData);
  const data = hasData ? apiData : sampleTasks;
  return {
    data,
    isLoading: query.isLoading,
    isError: query.isError,
    isFallback: !!query.error || !hasData,
    refetch: query.refetch
  };
}

export function usePortalOrders(enabled = true) {
  const query = useQuery({
    queryKey: ['portal-orders'],
    queryFn: () => api.listPortalOrders(),
    retry: 1,
    enabled
  });
  const apiData = query.data;
  const hasData = hasOrdersData(apiData);
  const data = hasData ? apiData : sampleOrders;
  return {
    data,
    isLoading: query.isLoading,
    isError: query.isError,
    isFallback: !!query.error || !hasData,
    refetch: query.refetch
  };
}

export function useAgentStatuses(enabled = true) {
  const query = useQuery({
    queryKey: ['agent-status'],
    queryFn: () => api.listAgentStatus(),
    retry: 1,
    enabled
  });
  const apiData = query.data;
  const hasData = hasAgentStatusData(apiData);
  const data = hasData ? apiData : sampleAgentStatus;
  return {
    data,
    isLoading: query.isLoading,
    isError: query.isError,
    isFallback: !!query.error || !hasData,
    refetch: query.refetch
  };
}
