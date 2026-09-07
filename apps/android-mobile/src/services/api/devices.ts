import axios from 'axios';
import { del, get, patch, post, put } from './client';
import type {
  ApiEnvelope,
  CreateGeofencePayload,
  EmergencyContact,
  LocationSnapshot,
  RegisterDevicePayload,
  SSDevice,
  SSGeofence,
  SSLocationEvent,
  SSSubscription,
} from '../../types/mobile';

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

export async function listDevices(): Promise<SSDevice[]> {
  const response = await get<ApiEnvelope<{ devices: SSDevice[] }>>(
    '/api/safe-sound/devices',
  );
  return unwrap(response).devices;
}

export async function registerDevice(
  payload: RegisterDevicePayload,
): Promise<SSDevice> {
  const response = await post<ApiEnvelope<{ device: SSDevice }>>(
    '/api/safe-sound/devices/register',
    payload,
  );
  return unwrap(response).device;
}

export async function getDevice(deviceId: string): Promise<SSDevice> {
  const response = await get<ApiEnvelope<{ device: SSDevice }>>(
    `/api/safe-sound/devices/${deviceId}`,
  );
  return unwrap(response).device;
}

export async function updateDevice(
  deviceId: string,
  patchBody: Partial<SSDevice>,
): Promise<SSDevice> {
  const response = await patch<ApiEnvelope<{ device: SSDevice }>>(
    `/api/safe-sound/devices/${deviceId}`,
    patchBody,
  );
  return unwrap(response).device;
}

export async function deleteDevice(deviceId: string): Promise<void> {
  const response = await del<ApiEnvelope<{ success: true }>>(
    `/api/safe-sound/devices/${deviceId}`,
  );
  unwrap(response);
}

export async function getDeviceLocation(
  deviceId: string,
): Promise<LocationSnapshot> {
  const response = await get<ApiEnvelope<{ location: LocationSnapshot }>>(
    `/api/safe-sound/devices/${deviceId}/location`,
  );
  return unwrap(response).location;
}

export async function postDeviceLocation(
  deviceId: string,
  location: Omit<LocationSnapshot, 'address'>,
): Promise<LocationSnapshot> {
  const response = await post<ApiEnvelope<{ location: LocationSnapshot }>>(
    `/api/safe-sound/devices/${deviceId}/location`,
    location,
  );
  return unwrap(response).location;
}

export interface LocationHistoryParams {
  limit?: number;
  from?: string;
  to?: string;
}

export async function getDeviceHistory(
  deviceId: string,
  params?: LocationHistoryParams,
): Promise<SSLocationEvent[]> {
  const response = await get<ApiEnvelope<{ events: SSLocationEvent[] }>>(
    `/api/safe-sound/devices/${deviceId}/history`,
    { params },
  );
  return unwrap(response).events;
}

export async function setLostMode(
  deviceId: string,
  active: boolean,
): Promise<SSDevice> {
  const response = await post<ApiEnvelope<{ device: SSDevice }>>(
    `/api/safe-sound/devices/${deviceId}/lost-mode`,
    { active },
  );
  return unwrap(response).device;
}

export async function setRcCoreConsent(
  deviceId: string,
  consent: boolean,
): Promise<SSDevice> {
  const response = await put<ApiEnvelope<{ device: SSDevice }>>(
    `/api/safe-sound/devices/${deviceId}/rc-core-consent`,
    { consent },
  );
  return unwrap(response).device;
}

export async function listGeofences(deviceId: string): Promise<SSGeofence[]> {
  const response = await get<ApiEnvelope<{ geofences: SSGeofence[] }>>(
    `/api/safe-sound/devices/${deviceId}/geofences`,
  );
  return unwrap(response).geofences;
}

export async function createGeofence(
  deviceId: string,
  payload: CreateGeofencePayload,
): Promise<SSGeofence> {
  const response = await post<ApiEnvelope<{ geofence: SSGeofence }>>(
    `/api/safe-sound/devices/${deviceId}/geofences`,
    payload,
  );
  return unwrap(response).geofence;
}

export async function deleteGeofence(geofenceId: string): Promise<void> {
  const response = await del<ApiEnvelope<{ success: true }>>(
    `/api/safe-sound/geofences/${geofenceId}`,
  );
  unwrap(response);
}

export async function saveEmergencyContacts(
  contacts: EmergencyContact[],
): Promise<EmergencyContact[]> {
  const response = await post<ApiEnvelope<{ contacts: EmergencyContact[] }>>(
    '/api/safe-sound/emergency-contacts',
    { contacts },
  );
  return unwrap(response).contacts;
}

export async function updatePreferredLanguage(
  languageCode: string,
): Promise<{ preferredLanguage: string }> {
  const response = await patch<ApiEnvelope<{ preferredLanguage: string }>>(
    '/api/safe-sound/profile/language',
    { languageCode },
  );
  return unwrap(response);
}

export interface CreateSubscriptionPayload {
  deviceSerial: string;
  paymentMethodId: string;
}

export async function createSubscription(
  payload: CreateSubscriptionPayload,
): Promise<{ subscription: SSSubscription; clientSecret: string }> {
  const response = await post<
    ApiEnvelope<{ subscription: SSSubscription; clientSecret: string }>
  >('/api/safe-sound/subscriptions', payload);
  return unwrap(response);
}

export async function listSubscriptions(): Promise<SSSubscription[]> {
  const response = await get<ApiEnvelope<{ subscriptions: SSSubscription[] }>>(
    '/api/safe-sound/subscriptions',
  );
  return unwrap(response).subscriptions;
}

export async function getSubscriptionPortalUrl(
  subscriptionId: string,
): Promise<string> {
  const response = await post<ApiEnvelope<{ url: string }>>(
    `/api/safe-sound/subscriptions/${subscriptionId}/portal`,
  );
  return unwrap(response).url;
}

export type ActivationStatus =
  | 'pending'
  | 'activating_esim'
  | 'connecting_network'
  | 'acquiring_location'
  | 'ready'
  | 'failed';

export async function getActivationStatus(
  serial: string,
): Promise<{ status: ActivationStatus; message?: string }> {
  const response = await get<
    ApiEnvelope<{ status: ActivationStatus; message?: string }>
  >(`/api/safe-sound/devices/${serial}/activation-status`);
  return unwrap(response);
}

export function isDevicesApiError(error: unknown): string | null {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error.message : null;
  }
  const envelope = error.response?.data as ApiEnvelope<unknown> | undefined;
  return envelope?.error ?? error.message;
}
