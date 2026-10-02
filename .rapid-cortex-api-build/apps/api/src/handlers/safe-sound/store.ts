import { createHash } from "node:crypto";
import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import type {
  EmergencyContact,
  GuardianEmergencyEvent,
  LocationSnapshot,
  SSDevice,
  SSGeofence,
  SSLocationEvent,
} from "rapid-cortex-shared";
import { ddb } from "../../repositories/baseRepository.js";
import { env } from "../../lib/env.js";
import { makeId } from "../../lib/ids.js";
import {
  agencyPk,
  contactSk,
  deviceSk,
  geofenceSk,
  guardianEventSk,
  locationSk,
  useGuardianMock,
  useSafeSoundMock,
} from "./shared.js";

const mockDevices = new Map<string, SSDevice & { agencyId: string }>();
const mockGeofences = new Map<string, SSGeofence & { agencyId: string }>();
const mockContacts = new Map<string, EmergencyContact & { agencyId: string }>();
const mockLocations = new Map<string, LocationSnapshot & { agencyId: string; deviceId: string }>();
const mockLocationHistory = new Map<string, SSLocationEvent & { agencyId: string }>();
const mockGuardianEvents = new Map<string, GuardianEmergencyEvent & { agencyId: string }>();

function deviceKey(agencyId: string, deviceId: string): string {
  return `${agencyId}::${deviceId}`;
}

function geofenceKey(agencyId: string, geofenceId: string): string {
  return `${agencyId}::${geofenceId}`;
}

function contactKey(agencyId: string, contactId: string): string {
  return `${agencyId}::${contactId}`;
}

function guardianKey(agencyId: string, eventId: string): string {
  return `${agencyId}::${eventId}`;
}

async function dynamoGet<T>(agencyId: string, sk: string): Promise<T | null> {
  const out = await ddb.send(
    new GetCommand({
      TableName: env.safeSoundDevicesTable,
      Key: { pk: agencyPk(agencyId), sk },
    }),
  );
  return (out.Item as T | undefined) ?? null;
}

async function dynamoPut(agencyId: string, sk: string, item: Record<string, unknown>): Promise<void> {
  await ddb.send(
    new PutCommand({
      TableName: env.safeSoundDevicesTable,
      Item: { pk: agencyPk(agencyId), sk, agencyId, ...item },
    }),
  );
}

async function dynamoDelete(agencyId: string, sk: string): Promise<void> {
  await ddb.send(
    new DeleteCommand({
      TableName: env.safeSoundDevicesTable,
      Key: { pk: agencyPk(agencyId), sk },
    }),
  );
}

async function dynamoQueryByPrefix<T>(agencyId: string, skPrefix: string): Promise<T[]> {
  const out = await ddb.send(
    new QueryCommand({
      TableName: env.safeSoundDevicesTable,
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
      ExpressionAttributeValues: {
        ":pk": agencyPk(agencyId),
        ":prefix": skPrefix,
      },
    }),
  );
  return (out.Items ?? []) as T[];
}

export async function listDevices(agencyId: string, ownerId: string): Promise<SSDevice[]> {
  if (useSafeSoundMock()) {
    return [...mockDevices.values()]
      .filter((d) => d.agencyId === agencyId && d.ownerId === ownerId)
      .map(({ agencyId: _a, ...device }) => device);
  }
  const rows = await dynamoQueryByPrefix<SSDevice & { agencyId: string; ownerId: string }>(
    agencyId,
    "SS_DEVICE#",
  );
  return rows.filter((d) => d.ownerId === ownerId).map(({ agencyId: _a, ...device }) => device);
}

export async function getDevice(agencyId: string, deviceId: string): Promise<(SSDevice & { agencyId: string }) | null> {
  if (useSafeSoundMock()) {
    return mockDevices.get(deviceKey(agencyId, deviceId)) ?? null;
  }
  return dynamoGet<SSDevice & { agencyId: string }>(agencyId, deviceSk(deviceId));
}

export async function putDevice(agencyId: string, device: SSDevice): Promise<SSDevice> {
  if (useSafeSoundMock()) {
    const row = { ...device, agencyId };
    mockDevices.set(deviceKey(agencyId, device.deviceId), row);
    return device;
  }
  await dynamoPut(agencyId, deviceSk(device.deviceId), device);
  return device;
}

export async function deleteDevice(agencyId: string, deviceId: string): Promise<boolean> {
  if (useSafeSoundMock()) {
    return mockDevices.delete(deviceKey(agencyId, deviceId));
  }
  await dynamoDelete(agencyId, deviceSk(deviceId));
  return true;
}

export async function getDeviceLocation(
  agencyId: string,
  deviceId: string,
): Promise<LocationSnapshot | null> {
  if (useSafeSoundMock()) {
    const loc = mockLocations.get(deviceKey(agencyId, deviceId));
    if (!loc) return null;
    const { agencyId: _a, deviceId: _d, ...snapshot } = loc;
    return snapshot;
  }
  const row = await dynamoGet<{ location: LocationSnapshot }>(
    agencyId,
    `SS_LOC_LATEST#${deviceId}`,
  );
  return row?.location ?? null;
}

export async function putDeviceLocation(
  agencyId: string,
  deviceId: string,
  location: LocationSnapshot,
): Promise<LocationSnapshot> {
  if (useSafeSoundMock()) {
    mockLocations.set(deviceKey(agencyId, deviceId), { ...location, agencyId, deviceId });
    const event: SSLocationEvent = {
      eventId: makeId("loc"),
      deviceId,
      location,
      recordedAt: location.timestamp,
    };
    mockLocationHistory.set(`${agencyId}::${event.eventId}`, { ...event, agencyId });
    return location;
  }
  await dynamoPut(agencyId, `SS_LOC_LATEST#${deviceId}`, { location, deviceId });
  const event: SSLocationEvent = {
    eventId: makeId("loc"),
    deviceId,
    location,
    recordedAt: location.timestamp,
  };
  await dynamoPut(agencyId, locationSk(deviceId, location.timestamp), event);
  return location;
}

export async function listLocationHistory(
  agencyId: string,
  deviceId: string,
  limit = 50,
): Promise<SSLocationEvent[]> {
  if (useSafeSoundMock()) {
    return [...mockLocationHistory.values()]
      .filter((e) => e.agencyId === agencyId && e.deviceId === deviceId)
      .slice(0, limit)
      .map(({ agencyId: _a, ...event }) => event);
  }
  const rows = await dynamoQueryByPrefix<SSLocationEvent>(
    agencyId,
    `SS_LOC#${deviceId}#`,
  );
  return rows.slice(0, limit);
}

export async function listGeofences(agencyId: string, deviceId: string): Promise<SSGeofence[]> {
  if (useSafeSoundMock()) {
    return [...mockGeofences.values()]
      .filter((g) => g.agencyId === agencyId && g.deviceId === deviceId)
      .map(({ agencyId: _a, ...geofence }) => geofence);
  }
  const rows = await dynamoQueryByPrefix<SSGeofence & { agencyId: string }>(
    agencyId,
    "SS_GEOFENCE#",
  );
  return rows.filter((g) => g.deviceId === deviceId).map(({ agencyId: _a, ...geofence }) => geofence);
}

export async function getGeofence(
  agencyId: string,
  geofenceId: string,
): Promise<(SSGeofence & { agencyId: string }) | null> {
  if (useSafeSoundMock()) {
    return mockGeofences.get(geofenceKey(agencyId, geofenceId)) ?? null;
  }
  return dynamoGet<SSGeofence & { agencyId: string }>(agencyId, geofenceSk(geofenceId));
}

export async function putGeofence(agencyId: string, geofence: SSGeofence): Promise<SSGeofence> {
  if (useSafeSoundMock()) {
    mockGeofences.set(geofenceKey(agencyId, geofence.geofenceId), { ...geofence, agencyId });
    return geofence;
  }
  await dynamoPut(agencyId, geofenceSk(geofence.geofenceId), geofence);
  return geofence;
}

export async function deleteGeofence(agencyId: string, geofenceId: string): Promise<boolean> {
  if (useSafeSoundMock()) {
    return mockGeofences.delete(geofenceKey(agencyId, geofenceId));
  }
  await dynamoDelete(agencyId, geofenceSk(geofenceId));
  return true;
}

export async function listContacts(agencyId: string, ownerId: string): Promise<EmergencyContact[]> {
  if (useSafeSoundMock()) {
    return [...mockContacts.values()]
      .filter((c) => c.agencyId === agencyId && c.ownerId === ownerId)
      .map(({ agencyId: _a, ...contact }) => contact);
  }
  const rows = await dynamoQueryByPrefix<EmergencyContact & { agencyId: string }>(
    agencyId,
    "SS_CONTACT#",
  );
  return rows.filter((c) => c.ownerId === ownerId).map(({ agencyId: _a, ...contact }) => contact);
}

export async function putContacts(
  agencyId: string,
  ownerId: string,
  contacts: EmergencyContact[],
): Promise<EmergencyContact[]> {
  if (useSafeSoundMock()) {
    for (const [key, row] of [...mockContacts.entries()]) {
      if (row.agencyId === agencyId && row.ownerId === ownerId) {
        mockContacts.delete(key);
      }
    }
    for (const contact of contacts) {
      mockContacts.set(contactKey(agencyId, contact.contactId), { ...contact, agencyId });
    }
    return contacts;
  }
  for (const contact of contacts) {
    await dynamoPut(agencyId, contactSk(contact.contactId), contact);
  }
  return contacts;
}

export async function getGuardianEvent(
  agencyId: string,
  eventId: string,
): Promise<(GuardianEmergencyEvent & { agencyId: string }) | null> {
  if (useGuardianMock()) {
    return mockGuardianEvents.get(guardianKey(agencyId, eventId)) ?? null;
  }
  const out = await ddb.send(
    new GetCommand({
      TableName: env.guardianEventsTable,
      Key: { pk: agencyPk(agencyId), sk: guardianEventSk(eventId) },
    }),
  );
  return (out.Item as (GuardianEmergencyEvent & { agencyId: string }) | undefined) ?? null;
}

export async function putGuardianEvent(
  agencyId: string,
  event: GuardianEmergencyEvent,
): Promise<GuardianEmergencyEvent> {
  if (useGuardianMock()) {
    mockGuardianEvents.set(guardianKey(agencyId, event.eventId), { ...event, agencyId });
    return event;
  }
  await ddb.send(
    new PutCommand({
      TableName: env.guardianEventsTable,
      Item: { pk: agencyPk(agencyId), sk: guardianEventSk(event.eventId), agencyId, ...event },
    }),
  );
  return event;
}

/** Seed a demo guardian event for mock/dev when none exists. */
export function seedMockGuardianEvent(
  agencyId: string,
  ownerId: string,
  eventId: string,
  deviceId: string,
): GuardianEmergencyEvent {
  const now = new Date();
  const detectedAt = now.toISOString();
  const cancelWindowExpiresAt = new Date(now.getTime() + 30_000).toISOString();
  const location: LocationSnapshot = {
    lat: 33.749,
    lng: -84.388,
    accuracy: 12,
    source: "gps",
    timestamp: detectedAt,
  };
  const event: GuardianEmergencyEvent = {
    eventId,
    deviceId,
    ownerId,
    detectionType: "fall",
    detectionConfidence: 0.87,
    detectedAt,
    cancelWindowExpiresAt,
    status: "COUNTDOWN_ACTIVE",
    statusHistory: [
      { status: "DETECTED", transitionedAt: detectedAt },
      { status: "COUNTDOWN_ACTIVE", transitionedAt: detectedAt, detail: "30s cancel window" },
    ],
    location,
    sensorSnapshot: { fallConfidence: 0.87, motionDetected: true },
    batteryPct: 72,
    wearerLanguage: "en",
    wearerLanguageName: "English",
    wearerLanguageRTL: false,
    wearerLanguageSource: "user_preference",
    auditHash: createHash("sha256").update(`${eventId}:${detectedAt}`).digest("hex").slice(0, 32),
  };
  mockGuardianEvents.set(guardianKey(agencyId, eventId), { ...event, agencyId });
  return event;
}
