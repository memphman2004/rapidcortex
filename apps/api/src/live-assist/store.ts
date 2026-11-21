/**
 * Live Assist DynamoDB store.
 *
 * Table key shapes:
 *   LiveAssistProviders  → pk: TENANT#{tenantId}  sk: PROVIDER#{providerId}
 *   LiveAssistDevices    → pk: TENANT#{tenantId}  sk: DEVICE#{deviceId}
 *                          GSI: BY_PROVIDER — pk: PROVIDER#{providerId}  sk: DEVICE#{deviceId}
 *   LiveAssistSessions   → pk: TENANT#{tenantId}  sk: SESSION#{sessionId}
 *                          GSI: BY_DEVICE — pk: DEVICE#{deviceId}  sk: startedAt
 *   LiveAssistCoaching   → pk: SESSION#{sessionId}  sk: CHANNEL#{channelId}
 *   LiveAssistEvents     → pk: SESSION#{sessionId}  sk: EVT#{timestamp}#{eventId}
 *
 * agencyId === tenantId for all PSAP-role records (single-tenant entity).
 * rcsuperadmin accesses cross-tenant by passing the agencyId explicitly.
 *
 * DeletionPolicy: Retain — tables are defined in stack-data-layer.yaml.
 */
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { randomUUID } from "node:crypto";
import type {
  LiveAssistProvider,
  LiveAssistDevice,
  LiveAssistSession,
  LiveAssistCoachingChannel,
  LiveAssistEvent,
  LiveAssistEventType,
  LiveAssistStreamStatus,
  LiveAssistCoachingStatus,
  BodyCameraManufacturer,
} from "rapid-cortex-shared";
import { env } from "../lib/env.js";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

// ─── Table resolution (env variables) ────────────────────────────────────────

function providersTable(): string { return env.liveAssistProvidersTable; }
function devicesTable(): string    { return env.liveAssistDevicesTable; }
function sessionsTable(): string   { return env.liveAssistSessionsTable; }
function coachingTable(): string   { return env.liveAssistCoachingTable; }
function eventsTable(): string     { return env.liveAssistEventsTable; }

// ─── Providers ────────────────────────────────────────────────────────────────

export const liveAssistProviderStore = {
  async create(provider: Omit<LiveAssistProvider, "providerId" | "createdAt" | "updatedAt">): Promise<LiveAssistProvider> {
    const now = new Date().toISOString();
    const full: LiveAssistProvider = {
      ...provider,
      providerId: randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    await ddb.send(new PutCommand({
      TableName: providersTable(),
      Item: {
        pk: `TENANT#${full.tenantId}`,
        sk: `PROVIDER#${full.providerId}`,
        ...full,
      },
      ConditionExpression: "attribute_not_exists(pk)",
    }));
    return full;
  },

  async list(tenantId: string): Promise<LiveAssistProvider[]> {
    if (!providersTable()) return [];
    const result = await ddb.send(new QueryCommand({
      TableName: providersTable(),
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
      ExpressionAttributeValues: {
        ":pk": `TENANT#${tenantId}`,
        ":prefix": "PROVIDER#",
      },
    }));
    return (result.Items ?? []) as LiveAssistProvider[];
  },

  async get(tenantId: string, providerId: string): Promise<LiveAssistProvider | null> {
    if (!providersTable()) return null;
    const result = await ddb.send(new GetCommand({
      TableName: providersTable(),
      Key: { pk: `TENANT#${tenantId}`, sk: `PROVIDER#${providerId}` },
    }));
    return (result.Item as LiveAssistProvider | undefined) ?? null;
  },

  async updateStatus(
    tenantId: string,
    providerId: string,
    integrationStatus: LiveAssistProvider["integrationStatus"],
    lastError: string | null,
    lastValidatedAt: string | null,
  ): Promise<void> {
    if (!providersTable()) return;
    await ddb.send(new UpdateCommand({
      TableName: providersTable(),
      Key: { pk: `TENANT#${tenantId}`, sk: `PROVIDER#${providerId}` },
      UpdateExpression: "SET integrationStatus = :s, lastError = :e, lastValidatedAt = :v, updatedAt = :u",
      ExpressionAttributeValues: {
        ":s": integrationStatus,
        ":e": lastError,
        ":v": lastValidatedAt,
        ":u": new Date().toISOString(),
      },
    }));
  },
};

// ─── Devices ──────────────────────────────────────────────────────────────────

export const liveAssistDeviceStore = {
  async create(device: Omit<LiveAssistDevice, "deviceId" | "createdAt" | "updatedAt">): Promise<LiveAssistDevice> {
    const now = new Date().toISOString();
    const full: LiveAssistDevice = {
      ...device,
      deviceId: randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    await ddb.send(new PutCommand({
      TableName: devicesTable(),
      Item: {
        pk: `TENANT#${full.tenantId}`,
        sk: `DEVICE#${full.deviceId}`,
        gsi1pk: `PROVIDER#${full.providerId}`,
        gsi1sk: `DEVICE#${full.deviceId}`,
        ...full,
      },
      ConditionExpression: "attribute_not_exists(pk)",
    }));
    return full;
  },

  async list(tenantId: string): Promise<LiveAssistDevice[]> {
    if (!devicesTable()) return [];
    const result = await ddb.send(new QueryCommand({
      TableName: devicesTable(),
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
      ExpressionAttributeValues: {
        ":pk": `TENANT#${tenantId}`,
        ":prefix": "DEVICE#",
      },
    }));
    return (result.Items ?? []) as LiveAssistDevice[];
  },

  async get(tenantId: string, deviceId: string): Promise<LiveAssistDevice | null> {
    if (!devicesTable()) return null;
    const result = await ddb.send(new GetCommand({
      TableName: devicesTable(),
      Key: { pk: `TENANT#${tenantId}`, sk: `DEVICE#${deviceId}` },
    }));
    return (result.Item as LiveAssistDevice | undefined) ?? null;
  },

  async updateAssignment(
    tenantId: string,
    deviceId: string,
    officerId: string | null,
    unitId: string | null,
  ): Promise<void> {
    if (!devicesTable()) return;
    await ddb.send(new UpdateCommand({
      TableName: devicesTable(),
      Key: { pk: `TENANT#${tenantId}`, sk: `DEVICE#${deviceId}` },
      UpdateExpression: "SET assignedOfficerId = :o, agencyUnitId = :u, updatedAt = :t",
      ExpressionAttributeValues: {
        ":o": officerId,
        ":u": unitId,
        ":t": new Date().toISOString(),
      },
      ConditionExpression: "attribute_exists(pk)",
    }));
  },

  async updateConnectivity(
    tenantId: string,
    deviceId: string,
    state: LiveAssistDevice["connectivityState"],
    batteryPercent: number | null,
  ): Promise<void> {
    if (!devicesTable()) return;
    await ddb.send(new UpdateCommand({
      TableName: devicesTable(),
      Key: { pk: `TENANT#${tenantId}`, sk: `DEVICE#${deviceId}` },
      UpdateExpression: "SET connectivityState = :s, batteryPercent = :b, lastSeenAt = :t, updatedAt = :t",
      ExpressionAttributeValues: {
        ":s": state,
        ":b": batteryPercent,
        ":t": new Date().toISOString(),
      },
      ConditionExpression: "attribute_exists(pk)",
    }));
  },
};

// ─── Sessions ─────────────────────────────────────────────────────────────────

export const liveAssistSessionStore = {
  async create(session: Omit<LiveAssistSession, "sessionId" | "startedAt">): Promise<LiveAssistSession> {
    const full: LiveAssistSession = {
      ...session,
      sessionId: randomUUID(),
      startedAt: new Date().toISOString(),
    };
    await ddb.send(new PutCommand({
      TableName: sessionsTable(),
      Item: {
        pk: `TENANT#${full.tenantId}`,
        sk: `SESSION#${full.sessionId}`,
        gsi1pk: `DEVICE#${full.deviceId}`,
        gsi1sk: full.startedAt,
        ...full,
      },
      ConditionExpression: "attribute_not_exists(pk)",
    }));
    return full;
  },

  async get(tenantId: string, sessionId: string): Promise<LiveAssistSession | null> {
    if (!sessionsTable()) return null;
    const result = await ddb.send(new GetCommand({
      TableName: sessionsTable(),
      Key: { pk: `TENANT#${tenantId}`, sk: `SESSION#${sessionId}` },
    }));
    return (result.Item as LiveAssistSession | undefined) ?? null;
  },

  async listActive(tenantId: string): Promise<LiveAssistSession[]> {
    if (!sessionsTable()) return [];
    const result = await ddb.send(new QueryCommand({
      TableName: sessionsTable(),
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
      FilterExpression: "streamStatus <> :ended AND endedAt = :null",
      ExpressionAttributeValues: {
        ":pk": `TENANT#${tenantId}`,
        ":prefix": "SESSION#",
        ":ended": "ended",
        ":null": null,
      },
    }));
    return (result.Items ?? []) as LiveAssistSession[];
  },

  async updateStreamStatus(
    tenantId: string,
    sessionId: string,
    streamStatus: LiveAssistStreamStatus,
    updates: Partial<Pick<LiveAssistSession, "kvsChannelName" | "kvsStreamArn" | "streamTokenExpiresAt" | "measuredVideoDelayMs">>,
  ): Promise<void> {
    if (!sessionsTable()) return;
    const setExprs: string[] = ["streamStatus = :ss"];
    const vals: Record<string, unknown> = { ":ss": streamStatus };
    if (updates.kvsChannelName !== undefined) { setExprs.push("kvsChannelName = :kc"); vals[":kc"] = updates.kvsChannelName; }
    if (updates.kvsStreamArn !== undefined) { setExprs.push("kvsStreamArn = :ka"); vals[":ka"] = updates.kvsStreamArn; }
    if (updates.streamTokenExpiresAt !== undefined) { setExprs.push("streamTokenExpiresAt = :ste"); vals[":ste"] = updates.streamTokenExpiresAt; }
    if (updates.measuredVideoDelayMs !== undefined) { setExprs.push("measuredVideoDelayMs = :md"); vals[":md"] = updates.measuredVideoDelayMs; }
    await ddb.send(new UpdateCommand({
      TableName: sessionsTable(),
      Key: { pk: `TENANT#${tenantId}`, sk: `SESSION#${sessionId}` },
      UpdateExpression: `SET ${setExprs.join(", ")}`,
      ExpressionAttributeValues: vals,
      ConditionExpression: "attribute_exists(pk)",
    }));
  },

  async updateCoachingStatus(
    tenantId: string,
    sessionId: string,
    coachingStatus: LiveAssistCoachingStatus,
  ): Promise<void> {
    if (!sessionsTable()) return;
    await ddb.send(new UpdateCommand({
      TableName: sessionsTable(),
      Key: { pk: `TENANT#${tenantId}`, sk: `SESSION#${sessionId}` },
      UpdateExpression: "SET coachingStatus = :cs",
      ExpressionAttributeValues: { ":cs": coachingStatus },
      ConditionExpression: "attribute_exists(pk)",
    }));
  },

  async updateLocation(
    tenantId: string,
    sessionId: string,
    lat: number,
    lng: number,
    source: LiveAssistSession["locationSource"],
  ): Promise<void> {
    if (!sessionsTable()) return;
    await ddb.send(new UpdateCommand({
      TableName: sessionsTable(),
      Key: { pk: `TENANT#${tenantId}`, sk: `SESSION#${sessionId}` },
      UpdateExpression: "SET lastLatitude = :lat, lastLongitude = :lng, lastLocationAt = :t, locationSource = :src",
      ExpressionAttributeValues: {
        ":lat": lat,
        ":lng": lng,
        ":t": new Date().toISOString(),
        ":src": source,
      },
      ConditionExpression: "attribute_exists(pk)",
    }));
  },

  async end(tenantId: string, sessionId: string): Promise<void> {
    if (!sessionsTable()) return;
    await ddb.send(new UpdateCommand({
      TableName: sessionsTable(),
      Key: { pk: `TENANT#${tenantId}`, sk: `SESSION#${sessionId}` },
      UpdateExpression: "SET streamStatus = :ss, coachingStatus = :cs, endedAt = :t",
      ExpressionAttributeValues: {
        ":ss": "ended",
        ":cs": "ended",
        ":t": new Date().toISOString(),
      },
      ConditionExpression: "attribute_exists(pk)",
    }));
  },
};

// ─── Coaching Channels ────────────────────────────────────────────────────────

export const liveAssistCoachingStore = {
  async create(channel: Omit<LiveAssistCoachingChannel, "channelId">): Promise<LiveAssistCoachingChannel> {
    const full: LiveAssistCoachingChannel = {
      ...channel,
      channelId: randomUUID(),
    };
    await ddb.send(new PutCommand({
      TableName: coachingTable(),
      Item: {
        pk: `SESSION#${full.sessionId}`,
        sk: `CHANNEL#${full.channelId}`,
        ...full,
      },
    }));
    return full;
  },

  async getForSession(sessionId: string): Promise<LiveAssistCoachingChannel | null> {
    if (!coachingTable()) return null;
    const result = await ddb.send(new QueryCommand({
      TableName: coachingTable(),
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
      FilterExpression: "channelState <> :ended",
      ExpressionAttributeValues: {
        ":pk": `SESSION#${sessionId}`,
        ":prefix": "CHANNEL#",
        ":ended": "ended",
      },
      Limit: 1,
    }));
    return ((result.Items ?? [])[0] as LiveAssistCoachingChannel | undefined) ?? null;
  },

  async updateState(
    sessionId: string,
    channelId: string,
    channelState: LiveAssistCoachingChannel["channelState"],
    updates?: Partial<Pick<LiveAssistCoachingChannel, "officerAcknowledgedAt" | "startedAt" | "endedAt" | "activeFloorSupervisorId">>,
  ): Promise<void> {
    if (!coachingTable()) return;
    const setExprs = ["channelState = :cs"];
    const vals: Record<string, unknown> = { ":cs": channelState };
    if (updates?.officerAcknowledgedAt !== undefined) { setExprs.push("officerAcknowledgedAt = :oa"); vals[":oa"] = updates.officerAcknowledgedAt; }
    if (updates?.startedAt !== undefined) { setExprs.push("startedAt = :sa"); vals[":sa"] = updates.startedAt; }
    if (updates?.endedAt !== undefined) { setExprs.push("endedAt = :ea"); vals[":ea"] = updates.endedAt; }
    if (updates?.activeFloorSupervisorId !== undefined) { setExprs.push("activeFloorSupervisorId = :af"); vals[":af"] = updates.activeFloorSupervisorId; }
    await ddb.send(new UpdateCommand({
      TableName: coachingTable(),
      Key: { pk: `SESSION#${sessionId}`, sk: `CHANNEL#${channelId}` },
      UpdateExpression: `SET ${setExprs.join(", ")}`,
      ExpressionAttributeValues: vals,
    }));
  },
};

// ─── Events (Continuity Log) ──────────────────────────────────────────────────

export const liveAssistEventStore = {
  async append(
    tenantId: string,
    sessionId: string,
    eventType: LiveAssistEventType,
    actorId: string,
    metadata: Record<string, unknown> = {},
  ): Promise<LiveAssistEvent> {
    const now = new Date().toISOString();
    const event: LiveAssistEvent = {
      tenantId,
      sessionId,
      eventId: randomUUID(),
      eventType,
      actorId,
      timestamp: now,
      metadata,
    };
    if (eventsTable()) {
      await ddb.send(new PutCommand({
        TableName: eventsTable(),
        Item: {
          pk: `SESSION#${sessionId}`,
          sk: `EVT#${now}#${event.eventId}`,
          ...event,
        },
      }));
    }
    return event;
  },

  async list(sessionId: string, limit = 50, since?: string): Promise<LiveAssistEvent[]> {
    if (!eventsTable()) return [];
    const result = await ddb.send(new QueryCommand({
      TableName: eventsTable(),
      KeyConditionExpression: since
        ? "pk = :pk AND sk > :since"
        : "pk = :pk AND begins_with(sk, :prefix)",
      ExpressionAttributeValues: since
        ? { ":pk": `SESSION#${sessionId}`, ":since": `EVT#${since}` }
        : { ":pk": `SESSION#${sessionId}`, ":prefix": "EVT#" },
      ScanIndexForward: false,
      Limit: limit,
    }));
    return ((result.Items ?? []) as LiveAssistEvent[]).reverse();
  },
};
