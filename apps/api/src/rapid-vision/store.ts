import { createHash, randomUUID } from "node:crypto";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import type {
  VisionAgencySettings,
  VisionCamera,
  VisionObservation,
  VisionSession,
  VisionTranscriptSegment,
  VisionTranscriptStatus,
} from "rapid-cortex-shared";
import { env } from "../lib/env.js";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

function camerasTable(): string {
  return env.visionCamerasTable;
}

function sessionsTable(): string {
  return env.visionSessionsTable;
}

function observationsTable(): string {
  return env.visionObservationsTable;
}

function consentTable(): string {
  return env.visionOwnerConsentTable;
}

function transcriptsTable(): string {
  return env.visionTranscriptsTable;
}

export function hashVisionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export const visionStore = {
  async listCamerasForAgency(agencyId: string): Promise<VisionCamera[]> {
    if (!camerasTable()) return [];
    const result = await ddb.send(
      new QueryCommand({
        TableName: camerasTable(),
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: { ":pk": `AGENCY#${agencyId}` },
      }),
    );
    return (result.Items ?? []).filter((item) => item.sk !== "SETTINGS#agency") as VisionCamera[];
  },

  async getCamera(agencyId: string, cameraId: string): Promise<VisionCamera | null> {
    if (!camerasTable()) return null;
    const result = await ddb.send(
      new GetCommand({
        TableName: camerasTable(),
        Key: { pk: `AGENCY#${agencyId}`, sk: `CAMERA#${cameraId}` },
      }),
    );
    const item = result.Item;
    if (!item || item.agencyId !== agencyId) return null;
    return item as VisionCamera;
  },

  async putCamera(camera: VisionCamera): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: camerasTable(),
        Item: {
          pk: `AGENCY#${camera.agencyId}`,
          sk: `CAMERA#${camera.cameraId}`,
          ...camera,
        },
        ConditionExpression: "attribute_not_exists(pk) OR agencyId = :a",
        ExpressionAttributeValues: { ":a": camera.agencyId },
      }),
    );
  },

  async putSession(session: VisionSession & { ttl?: number; consentTokenHash?: string }): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: sessionsTable(),
        Item: {
          pk: `INCIDENT#${session.incidentId}`,
          sk: `SESSION#${session.sessionId}`,
          ...session,
        },
        ConditionExpression: "attribute_not_exists(pk) OR agencyId = :a",
        ExpressionAttributeValues: { ":a": session.agencyId },
      }),
    );
  },

  async getSession(incidentId: string, sessionId: string, agencyId: string): Promise<VisionSession | null> {
    const result = await ddb.send(
      new GetCommand({
        TableName: sessionsTable(),
        Key: { pk: `INCIDENT#${incidentId}`, sk: `SESSION#${sessionId}` },
      }),
    );
    const item = result.Item;
    if (!item || item.agencyId !== agencyId) return null;
    return item as VisionSession;
  },

  async listSessionsForIncident(agencyId: string, incidentId: string): Promise<VisionSession[]> {
    if (!sessionsTable()) return [];
    const result = await ddb.send(
      new QueryCommand({
        TableName: sessionsTable(),
        KeyConditionExpression: "pk = :pk",
        FilterExpression: "agencyId = :a",
        ExpressionAttributeValues: {
          ":pk": `INCIDENT#${incidentId}`,
          ":a": agencyId,
        },
      }),
    );
    return (result.Items ?? []) as VisionSession[];
  },

  async listActiveAiSessions(): Promise<Array<VisionSession & { startedAt?: string }>> {
    if (!sessionsTable()) return [];
    const result = await ddb.send(
      new QueryCommand({
        TableName: sessionsTable(),
        IndexName: "ByAiStatus",
        KeyConditionExpression: "aiAnalysisStatus = :s",
        FilterExpression: "expiresAt > :now",
        ExpressionAttributeValues: {
          ":s": "active",
          ":now": new Date().toISOString(),
        },
      }),
    );
    return (result.Items ?? []) as Array<VisionSession & { startedAt?: string }>;
  },

  async updateSessionAnalyzedAt(incidentId: string, sessionId: string, agencyId: string): Promise<void> {
    await ddb.send(
      new UpdateCommand({
        TableName: sessionsTable(),
        Key: { pk: `INCIDENT#${incidentId}`, sk: `SESSION#${sessionId}` },
        UpdateExpression: "SET lastAnalyzedAt = :t",
        ConditionExpression: "agencyId = :a",
        ExpressionAttributeValues: { ":t": new Date().toISOString(), ":a": agencyId },
      }),
    );
  },

  async markSessionExpired(incidentId: string, sessionId: string, agencyId: string): Promise<void> {
    await ddb.send(
      new UpdateCommand({
        TableName: sessionsTable(),
        Key: { pk: `INCIDENT#${incidentId}`, sk: `SESSION#${sessionId}` },
        UpdateExpression: "SET #s = :expired, aiAnalysisStatus = :stopped",
        ConditionExpression: "agencyId = :a",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: { ":expired": "expired", ":stopped": "stopped", ":a": agencyId },
      }),
    );
  },

  async activateSession(incidentId: string, sessionId: string, agencyId: string): Promise<void> {
    await ddb.send(
      new UpdateCommand({
        TableName: sessionsTable(),
        Key: { pk: `INCIDENT#${incidentId}`, sk: `SESSION#${sessionId}` },
        UpdateExpression: "SET #s = :active, aiAnalysisStatus = :ai, authorizedBy = :owner",
        ConditionExpression: "agencyId = :a",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: {
          ":active": "active",
          ":ai": "active",
          ":owner": "owner",
          ":a": agencyId,
        },
      }),
    );
  },

  async declineSession(incidentId: string, sessionId: string, agencyId: string): Promise<void> {
    await ddb.send(
      new UpdateCommand({
        TableName: sessionsTable(),
        Key: { pk: `INCIDENT#${incidentId}`, sk: `SESSION#${sessionId}` },
        UpdateExpression: "SET #s = :declined, aiAnalysisStatus = :stopped",
        ConditionExpression: "agencyId = :a",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: {
          ":declined": "declined",
          ":stopped": "stopped",
          ":a": agencyId,
        },
      }),
    );
  },

  async putConsentToken(params: {
    token: string;
    agencyId: string;
    incidentId: string;
    sessionId: string;
    expiresAt: string;
  }): Promise<void> {
    const tokenHash = hashVisionToken(params.token);
    await ddb.send(
      new PutCommand({
        TableName: consentTable() || sessionsTable(),
        Item: {
          pk: `TOKEN#${tokenHash}`,
          sk: `CONSENT#${params.sessionId}`,
          agencyId: params.agencyId,
          incidentId: params.incidentId,
          sessionId: params.sessionId,
          expiresAt: params.expiresAt,
          ttl: Math.floor(new Date(params.expiresAt).getTime() / 1000) + 3600,
        },
      }),
    );
  },

  async getConsentByToken(token: string): Promise<{
    agencyId: string;
    incidentId: string;
    sessionId: string;
    expiresAt: string;
  } | null> {
    const table = consentTable() || sessionsTable();
    const tokenHash = hashVisionToken(token);
    const result = await ddb.send(
      new QueryCommand({
        TableName: table,
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: { ":pk": `TOKEN#${tokenHash}` },
        Limit: 1,
      }),
    );
    const item = result.Items?.[0];
    if (!item) return null;
    return {
      agencyId: String(item.agencyId),
      incidentId: String(item.incidentId),
      sessionId: String(item.sessionId),
      expiresAt: String(item.expiresAt),
    };
  },

  async putObservation(observation: VisionObservation): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: observationsTable(),
        Item: {
          pk: `INCIDENT#${observation.incidentId}`,
          sk: `OBS#${observation.timestamp}#${observation.observationId}`,
          ...observation,
        },
        ConditionExpression: "attribute_not_exists(pk) OR agencyId = :a",
        ExpressionAttributeValues: { ":a": observation.agencyId },
      }),
    );
  },

  async listObservations(agencyId: string, incidentId: string, limit = 100): Promise<VisionObservation[]> {
    if (!observationsTable()) return [];
    const result = await ddb.send(
      new QueryCommand({
        TableName: observationsTable(),
        KeyConditionExpression: "pk = :pk",
        FilterExpression: "agencyId = :a",
        ExpressionAttributeValues: {
          ":pk": `INCIDENT#${incidentId}`,
          ":a": agencyId,
        },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    return (result.Items ?? []) as VisionObservation[];
  },

  async getObservation(
    agencyId: string,
    incidentId: string,
    observationId: string,
  ): Promise<VisionObservation | null> {
    const items = await this.listObservations(agencyId, incidentId, 200);
    return items.find((o) => o.observationId === observationId) ?? null;
  },

  async updateObservationStatus(params: {
    agencyId: string;
    incidentId: string;
    timestamp: string;
    observationId: string;
    status: "verified" | "rejected";
    userId: string;
  }): Promise<void> {
    await ddb.send(
      new UpdateCommand({
        TableName: observationsTable(),
        Key: {
          pk: `INCIDENT#${params.incidentId}`,
          sk: `OBS#${params.timestamp}#${params.observationId}`,
        },
        UpdateExpression:
          "SET verificationStatus = :s, verifiedBy = :u, verifiedAt = :t",
        ConditionExpression: "agencyId = :a",
        ExpressionAttributeValues: {
          ":s": params.status,
          ":u": params.userId,
          ":t": new Date().toISOString(),
          ":a": params.agencyId,
        },
      }),
    );
  },

  async getSettings(agencyId: string): Promise<VisionAgencySettings> {
    const defaults: VisionAgencySettings = {
      agencyId,
      enabled: true,
      enabledProviders: ["ring", "caller_video", "demo"],
      enableCallerVideoAnalysis: true,
      cameraSearchRadiusMeters: 500,
      defaultAccessDurationMinutes: 15,
      aiAnalysisLevel: "NORMAL",
      enabledDetectionCategories: [],
      retentionDays: 30,
      enableResponderSharing: false,
      ownerConsentPolicy: "ask_every_time",
      aiBudgetThresholdMonthlyUSD: 250,
      aiWriterIntervalSeconds: 30,
      updatedAt: new Date().toISOString(),
      updatedBy: "system",
    };
    if (!camerasTable()) return defaults;
    const result = await ddb.send(
      new GetCommand({
        TableName: camerasTable(),
        Key: { pk: `AGENCY#${agencyId}`, sk: "SETTINGS#agency" },
      }),
    );
    if (!result.Item || result.Item.agencyId !== agencyId) return defaults;
    return { ...defaults, ...(result.Item as VisionAgencySettings) };
  },

  async putSettings(settings: VisionAgencySettings): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: camerasTable(),
        Item: {
          pk: `AGENCY#${settings.agencyId}`,
          sk: "SETTINGS#agency",
          ...settings,
        },
      }),
    );
  },

  async updateTranscriptStatus(params: {
    incidentId: string;
    sessionId: string;
    agencyId: string;
    status: VisionTranscriptStatus;
    startedBy?: string;
  }): Promise<void> {
    const now = new Date().toISOString();
    const started = params.status === "active";
    await ddb.send(
      new UpdateCommand({
        TableName: sessionsTable(),
        Key: { pk: `INCIDENT#${params.incidentId}`, sk: `SESSION#${params.sessionId}` },
        UpdateExpression: started
          ? "SET transcriptStatus = :s, transcriptStartedAt = :t, transcriptStartedBy = :u"
          : "SET transcriptStatus = :s, transcriptStoppedAt = :t",
        ConditionExpression: "agencyId = :a",
        ExpressionAttributeValues: started
          ? {
              ":s": params.status,
              ":t": now,
              ":u": params.startedBy ?? "system",
              ":a": params.agencyId,
            }
          : {
              ":s": params.status,
              ":t": now,
              ":a": params.agencyId,
            },
      }),
    );
  },

  async listTranscriptSegments(params: {
    agencyId: string;
    incidentId: string;
    sessionId?: string;
    limit?: number;
  }): Promise<VisionTranscriptSegment[]> {
    if (!transcriptsTable()) return [];
    const limit = params.limit ?? 100;
    if (params.sessionId) {
      const result = await ddb.send(
        new QueryCommand({
          TableName: transcriptsTable(),
          IndexName: "BySession",
          KeyConditionExpression: "sessionId = :s",
          FilterExpression: "agencyId = :a AND incidentId = :i",
          ExpressionAttributeValues: {
            ":s": params.sessionId,
            ":a": params.agencyId,
            ":i": params.incidentId,
          },
          ScanIndexForward: true,
          Limit: limit,
        }),
      );
      return (result.Items ?? []) as VisionTranscriptSegment[];
    }
    const result = await ddb.send(
      new QueryCommand({
        TableName: transcriptsTable(),
        KeyConditionExpression: "pk = :pk",
        FilterExpression: "agencyId = :a",
        ExpressionAttributeValues: {
          ":pk": `INCIDENT#${params.incidentId}`,
          ":a": params.agencyId,
        },
        ScanIndexForward: true,
        Limit: limit,
      }),
    );
    return (result.Items ?? []) as VisionTranscriptSegment[];
  },
};

export function newVisionIds() {
  return { sessionId: randomUUID(), observationId: randomUUID(), cameraId: randomUUID() };
}
