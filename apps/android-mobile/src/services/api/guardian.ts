import axios from 'axios';
import { get, post } from './client';
import type { ApiEnvelope, GuardianEmergencyEvent } from '../../types/mobile';

function unwrap<T>(response: { data: ApiEnvelope<T> }): T {
  const envelope = response.data;
  if (!envelope.success) {
    throw new Error(envelope.error ?? 'Request failed');
  }
  if (envelope.data === undefined) {
    throw new Error('Response missing data payload');
  }
  return envelope.data;
}

export async function getGuardianEvent(
  eventId: string,
): Promise<GuardianEmergencyEvent> {
  const response = await get<ApiEnvelope<{ event: GuardianEmergencyEvent }>>(
    `/api/guardian/events/${eventId}`,
  );
  return unwrap(response).event;
}

export type GuardianCancelSource = 'wearer_app' | 'contact_app' | 'operator';

export async function cancelGuardianEvent(
  eventId: string,
  cancelledBy: GuardianCancelSource,
): Promise<GuardianEmergencyEvent> {
  const response = await post<ApiEnvelope<{ event: GuardianEmergencyEvent }>>(
    `/api/guardian/events/${eventId}/cancel`,
    { cancelledBy },
  );
  return unwrap(response).event;
}

export function isGuardianApiError(error: unknown): string | null {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error.message : null;
  }
  const envelope = error.response?.data as ApiEnvelope<unknown> | undefined;
  return envelope?.error ?? error.message;
}
