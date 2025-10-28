import { GrApiClient } from '@gr/api';

export const apiBase = import.meta.env.VITE_API_BASE || __API_BASE__;

export function createApiClient() {
  return new GrApiClient(apiBase);
}
