import axios from 'axios';
import { get } from './client';
import type { AgencySummary, ApiEnvelope } from '../../types/mobile';

function unwrap<T>(response: { data: ApiEnvelope<T> | T }): T {
  const payload = response.data;
  if (
    payload &&
    typeof payload === 'object' &&
    'success' in payload &&
    typeof (payload as ApiEnvelope<T>).success === 'boolean'
  ) {
    const envelope = payload as ApiEnvelope<T>;
    if (!envelope.success) {
      throw new Error(envelope.error ?? 'Request failed');
    }
    if (envelope.data === undefined) {
      throw new Error('Response missing data payload');
    }
    return envelope.data;
  }

  return payload as T;
}

export async function getAgency(agencyId: string): Promise<AgencySummary> {
  const response = await get<ApiEnvelope<AgencySummary> | AgencySummary>(
    `/api/agencies/${agencyId}`,
  );
  const data = unwrap(response);
  return {
    agencyId: data.agencyId ?? agencyId,
    name: data.name,
    agencyType: data.agencyType ?? null,
    vertical: data.vertical ?? null,
    jurisdictionSlug: data.jurisdictionSlug ?? null,
  };
}

export async function getAgencyProfile(agencyId: string): Promise<AgencySummary> {
  const response = await get<ApiEnvelope<AgencySummary> | AgencySummary>(
    `/api/agencies/${agencyId}/profile`,
  );
  const data = unwrap(response);
  return {
    agencyId: data.agencyId ?? agencyId,
    name: data.name,
    agencyType: data.agencyType ?? null,
    vertical: data.vertical ?? null,
    jurisdictionSlug: data.jurisdictionSlug ?? null,
  };
}

export function isAgenciesApiError(error: unknown): string | null {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error.message : null;
  }
  const envelope = error.response?.data as ApiEnvelope<unknown> | undefined;
  return envelope?.error ?? error.message;
}
