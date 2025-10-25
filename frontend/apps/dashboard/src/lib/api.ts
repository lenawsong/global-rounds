import { GrApiClient } from '@gr/api';

export const apiBase = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8001';

export function createApiClient() {
  return new GrApiClient(apiBase);
}

