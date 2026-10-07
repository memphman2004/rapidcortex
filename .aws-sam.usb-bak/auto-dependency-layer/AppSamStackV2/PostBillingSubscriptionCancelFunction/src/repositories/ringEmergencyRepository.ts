import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type {
  RingEmergencyCameraRequest,
  RingEmergencyCameraSession,
  RingRequestStatus,
} from "../lib/ring-integration.js";
import { ddb } from "./baseRepository.js";
import { env } from "../lib/env.js";

export type RingEmergencyRequestRecord = RingEmergencyCameraRequest & {
  agencyIncidentKey: string;
  /** Unix epoch seconds for DynamoDB TTL (table TTL attribute name: expiresAt). */
  expiresAtTtl: number;
};

export type RingEmergencySessionRecord = RingEmergencyCameraSession;

function requestsTable(): string {
  const t = env.ringRequestsTable?.trim();
  if (!t) throw new Error("RING_TABLE_REQUESTS_NOT_CONFIGURED");
  return t;
}

function sessionsTable(): string {
  const t = env.ringSessionsTable?.trim();
  if (!t) throw new Error("RING_TABLE_SESSIONS_NOT_CONFIGURED");
  return t;
}

export function agencyIncidentKey(agencyId: string, incidentId: string): string {
  return `${agencyId}#${incidentId}`;
}

function fromRequestItem(item: Record<string, unknown>): RingEmergencyCameraRequest {
  const expiresAtRaw = item.expiresAt;
  const expiresAt =
    typeof expiresAtRaw === "number"
      ? new Date(expiresAtRaw * 1000).toISOString()
      : String(expiresAtRaw ?? "");
  const { agencyIncidentKey: _k, expiresAtTtl: _ttl, itemType: _t, attemptCount: _a, ...rest } = item;
  return { ...rest, expiresAt } as RingEmergencyCameraRequest;
}

export class RingEmergencyRepository {
  async putRequest(record: RingEmergencyRequestRecord): Promise<void> {
    const { expiresAtTtl, ...request } = record;
    await ddb.send(
      new PutCommand({
        TableName: requestsTable(),
        Item: {
          ...request,
          agencyIncidentKey: record.agencyIncidentKey,
          expiresAt: expiresAtTtl,
          expiresAtIso: request.expiresAt,
        },
      }),
    );
  }

  async updateRequest(
    agencyId: string,
    incidentId: string,
    requestId: string,
    patch: Partial<RingEmergencyCameraRequest> & { expiresAtTtl?: number },
  ): Promise<void> {
    const sets: string[] = [];
    const values: Record<string, unknown> = {
      ":agencyId": agencyId,
    };
    const names: Record<string, string> = {};

    for (const [key, value] of Object.entries(patch)) {
      if (key === "expiresAtTtl") continue;
      if (value === undefined) continue;
      const attr = `#${key}`;
      const val = `:${key}`;
      names[attr] = key;
      sets.push(`${attr} = ${val}`);
      values[val] = value;
    }
    if (patch.expiresAtTtl !== undefined) {
      sets.push("expiresAt = :expiresAtTtl");
      values[":expiresAtTtl"] = patch.expiresAtTtl;
      if (patch.expiresAt) {
        sets.push("expiresAtIso = :expiresAtIso");
        values[":expiresAtIso"] = patch.expiresAt;
      }
    }

    if (sets.length === 0) return;

    await ddb.send(
      new UpdateCommand({
        TableName: requestsTable(),
        Key: { agencyIncidentKey: agencyIncidentKey(agencyId, incidentId), requestId },
        UpdateExpression: `SET ${sets.join(", ")}`,
        ExpressionAttributeNames: Object.keys(names).length ? names : undefined,
        ExpressionAttributeValues: values,
        ConditionExpression: "agencyId = :agencyId",
      }),
    );
  }

  async listRequestsForIncident(
    agencyId: string,
    incidentId: string,
  ): Promise<RingEmergencyCameraRequest[]> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: requestsTable(),
        KeyConditionExpression: "agencyIncidentKey = :key",
        ExpressionAttributeValues: {
          ":key": agencyIncidentKey(agencyId, incidentId),
        },
      }),
    );
    return (out.Items ?? [])
      .filter((item) => item.itemType !== "ring_consent_rate")
      .map((item) => fromRequestItem(item as Record<string, unknown>));
  }

  async findActiveRequestForDevice(
    agencyId: string,
    incidentId: string,
    deviceId: string,
  ): Promise<RingEmergencyCameraRequest | null> {
    const rows = await this.listRequestsForIncident(agencyId, incidentId);
    const active = rows
      .filter(
        (r) =>
          r.deviceId === deviceId &&
          (r.requestStatus === "SENT" || r.requestStatus === "APPROVED"),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return active[0] ?? null;
  }

  async countRequestsSince(
    agencyId: string,
    incidentId: string,
    sinceIso: string,
  ): Promise<number> {
    const rows = await this.listRequestsForIncident(agencyId, incidentId);
    return rows.filter((r) => r.createdAt >= sinceIso).length;
  }

  async latestRequestForDevice(
    agencyId: string,
    incidentId: string,
    deviceId: string,
  ): Promise<RingEmergencyCameraRequest | null> {
    const rows = await this.listRequestsForIncident(agencyId, incidentId);
    const matches = rows
      .filter((r) => r.deviceId === deviceId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return matches[0] ?? null;
  }

  async listSentRequestsNotExpired(nowMs = Date.now()): Promise<RingEmergencyCameraRequest[]> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: requestsTable(),
        IndexName: "requestStatus-index",
        KeyConditionExpression: "requestStatus = :status",
        ExpressionAttributeValues: { ":status": "SENT" },
      }),
    );
    return (out.Items ?? [])
      .filter((item) => item.itemType !== "ring_consent_rate")
      .map((item) => fromRequestItem(item as Record<string, unknown>))
      .filter((r) => new Date(r.expiresAt).getTime() > nowMs);
  }

  async getRequest(
    agencyId: string,
    incidentId: string,
    requestId: string,
  ): Promise<RingEmergencyCameraRequest | null> {
    const out = await ddb.send(
      new GetCommand({
        TableName: requestsTable(),
        Key: { agencyIncidentKey: agencyIncidentKey(agencyId, incidentId), requestId },
      }),
    );
    if (!out.Item || out.Item.itemType === "ring_consent_rate") return null;
    return fromRequestItem(out.Item as Record<string, unknown>);
  }

  async putSession(record: RingEmergencySessionRecord): Promise<void> {
    const expiresAtTtl = Math.floor(new Date(record.expiresAt).getTime() / 1000);
    await ddb.send(
      new PutCommand({
        TableName: sessionsTable(),
        Item: {
          ...record,
          expiresAt: expiresAtTtl,
          expiresAtIso: record.expiresAt,
        },
      }),
    );
  }

  async getSessionById(sessionId: string): Promise<RingEmergencyCameraSession | null> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: sessionsTable(),
        KeyConditionExpression: "sessionId = :sessionId",
        ExpressionAttributeValues: { ":sessionId": sessionId },
        Limit: 1,
      }),
    );
    const item = out.Items?.[0];
    if (!item) return null;
    const expiresAtRaw = item.expiresAt;
    const expiresAt =
      typeof expiresAtRaw === "number"
        ? new Date(expiresAtRaw * 1000).toISOString()
        : String(item.expiresAtIso ?? expiresAtRaw ?? "");
    const { expiresAtIso: _e, ...rest } = item;
    return { ...rest, expiresAt } as RingEmergencyCameraSession;
  }

  async updateSession(
    sessionId: string,
    createdAt: string,
    patch: Partial<RingEmergencyCameraSession>,
  ): Promise<void> {
    const sets: string[] = [];
    const values: Record<string, unknown> = { ":sessionId": sessionId };
    const names: Record<string, string> = {};

    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) continue;
      const attr = `#${key}`;
      const val = `:${key}`;
      names[attr] = key;
      sets.push(`${attr} = ${val}`);
      values[val] = value;
    }

    if (sets.length === 0) return;

    await ddb.send(
      new UpdateCommand({
        TableName: sessionsTable(),
        Key: { sessionId, createdAt },
        UpdateExpression: `SET ${sets.join(", ")}`,
        ExpressionAttributeNames: Object.keys(names).length ? names : undefined,
        ExpressionAttributeValues: values,
        ConditionExpression: "sessionId = :sessionId",
      }),
    );
  }

  async findRequestByIdAcrossIncident(
    requestId: string,
  ): Promise<RingEmergencyCameraRequest | null> {
    const statuses: RingRequestStatus[] = ["SENT", "APPROVED", "DRAFT", "DECLINED", "REVOKED"];
    for (const status of statuses) {
      const out = await ddb.send(
        new QueryCommand({
          TableName: requestsTable(),
          IndexName: "requestStatus-index",
          KeyConditionExpression: "requestStatus = :status",
          FilterExpression: "requestId = :requestId",
          ExpressionAttributeValues: { ":status": status, ":requestId": requestId },
          Limit: 1,
        }),
      );
      const item = out.Items?.[0];
      if (item && item.itemType !== "ring_consent_rate") {
        return fromRequestItem(item as Record<string, unknown>);
      }
    }
    return null;
  }
}
