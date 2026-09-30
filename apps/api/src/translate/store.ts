import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type {
  TranslateAssistanceEncounter,
  TranslateSegment,
  TranslateSession,
  TranslateSessionStatus,
  TranslateVertical,
} from "rapid-cortex-shared";
import { ddb } from "../repositories/baseRepository.js";
import { env } from "../lib/env.js";

const SESSION_SK = "SESSION";

export type TranslateConnectionRecord = {
  connectionId: string;
  sessionId: string;
  agencyId: string;
  userId: string;
  wsRole: "officer" | "monitor";
  displayName?: string;
  ttl: number;
};

function sessionsTable(): string {
  const t = env.translateSessionsTable;
  if (!t) throw new Error("TRANSLATE_SESSIONS_TABLE is not configured");
  return t;
}

function segmentsTable(): string {
  const t = env.translateSegmentsTable;
  if (!t) throw new Error("TRANSLATE_SEGMENTS_TABLE is not configured");
  return t;
}

function connectionsTable(): string {
  const t = env.translateConnectionsTable;
  if (!t) throw new Error("TRANSLATE_CONNECTIONS_TABLE is not configured");
  return t;
}

export function sessionPk(agencyId: string, sessionId: string): string {
  return `${agencyId}#${sessionId}`;
}

export function assistancePk(agencyId: string): string {
  return `AGENCY#${agencyId}`;
}

export function assistanceSk(assistMonth: string, sessionId: string): string {
  return `ASSIST#${assistMonth}#${sessionId}`;
}

function stripSession(item: Record<string, unknown>): TranslateSession {
  const { pk: _pk, sk: _sk, ...rest } = item;
  const vertical = (rest.vertical as TranslateVertical | undefined) ?? "law_enforcement";
  return {
    ...(rest as unknown as TranslateSession),
    vertical,
    monitorUserIds: Array.isArray(rest.monitorUserIds) ? (rest.monitorUserIds as string[]) : [],
  };
}

function stripSegment(item: Record<string, unknown>): TranslateSegment {
  const { sk: _sk, ...rest } = item;
  return rest as unknown as TranslateSegment;
}

function stripAssistance(item: Record<string, unknown>): TranslateAssistanceEncounter {
  const { pk: _pk, sk: _sk, entityType: _et, ...rest } = item;
  return rest as unknown as TranslateAssistanceEncounter;
}

export const translateStore = {
  async putSession(session: TranslateSession): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: sessionsTable(),
        Item: {
          ...session,
          pk: sessionPk(session.agencyId, session.sessionId),
          sk: SESSION_SK,
        },
      }),
    );
  },

  async getSession(agencyId: string, sessionId: string): Promise<TranslateSession | null> {
    const out = await ddb.send(
      new GetCommand({
        TableName: sessionsTable(),
        Key: { pk: sessionPk(agencyId, sessionId), sk: SESSION_SK },
      }),
    );
    if (!out.Item) return null;
    return stripSession(out.Item);
  },

  async listByAgencyStatus(
    agencyId: string,
    status: TranslateSessionStatus,
    opts?: { vertical?: TranslateVertical; limit?: number },
  ): Promise<TranslateSession[]> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: sessionsTable(),
        IndexName: "byAgencyStatus",
        KeyConditionExpression: "agencyId = :a AND #st = :s",
        ExpressionAttributeNames: { "#st": "status" },
        ExpressionAttributeValues: {
          ":a": agencyId,
          ":s": status,
          ...(opts?.vertical ? { ":v": opts.vertical } : {}),
        },
        ...(opts?.vertical === "law_enforcement"
          ? { FilterExpression: "vertical = :v OR attribute_not_exists(vertical)" }
          : opts?.vertical
            ? { FilterExpression: "vertical = :v" }
            : {}),
        ScanIndexForward: false,
        Limit: opts?.limit ?? 50,
      }),
    );
    let items = (out.Items ?? []).map((row) => stripSession(row));
    if (opts?.vertical === "law_enforcement") {
      items = items.filter((s) => (s.vertical ?? "law_enforcement") === "law_enforcement");
    } else if (opts?.vertical) {
      items = items.filter((s) => s.vertical === opts.vertical);
    }
    return items;
  },

  async listByIncident(incidentId: string): Promise<TranslateSession[]> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: sessionsTable(),
        IndexName: "byIncident",
        KeyConditionExpression: "incidentId = :i",
        ExpressionAttributeValues: { ":i": incidentId },
        ScanIndexForward: false,
        Limit: 50,
      }),
    );
    return (out.Items ?? []).map((row) => stripSession(row));
  },

  async putAssistanceEncounter(row: TranslateAssistanceEncounter): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: sessionsTable(),
        Item: {
          ...row,
          pk: assistancePk(row.agencyId),
          sk: assistanceSk(row.assistMonth, row.sessionId),
          entityType: "ASSISTANCE",
        },
      }),
    );
  },

  async listAssistanceEncounters(
    agencyId: string,
    opts: { fromIso: string; toIso: string; limit?: number },
  ): Promise<TranslateAssistanceEncounter[]> {
    const fromMonth = opts.fromIso.slice(0, 7);
    const toMonth = opts.toIso.slice(0, 7);
    const out = await ddb.send(
      new QueryCommand({
        TableName: sessionsTable(),
        KeyConditionExpression: "pk = :pk AND sk BETWEEN :fromSk AND :toSk",
        ExpressionAttributeValues: {
          ":pk": assistancePk(agencyId),
          ":fromSk": `ASSIST#${fromMonth}`,
          ":toSk": `ASSIST#${toMonth}\uffff`,
        },
        ScanIndexForward: true,
        Limit: opts.limit ?? 5000,
      }),
    );
    const fromMs = Date.parse(opts.fromIso);
    const toMs = Date.parse(opts.toIso);
    return (out.Items ?? [])
      .map((row) => stripAssistance(row))
      .filter((row) => {
        const ended = Date.parse(row.endedAt);
        return Number.isFinite(ended) && ended >= fromMs && ended <= toMs;
      });
  },

  async putSegment(segment: TranslateSegment): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: segmentsTable(),
        Item: {
          ...segment,
          sk: `ts#${segment.timestamp}#${segment.segmentId}`,
        },
      }),
    );
  },

  async listSegments(sessionId: string, agencyId: string): Promise<TranslateSegment[]> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: segmentsTable(),
        KeyConditionExpression: "sessionId = :s",
        ExpressionAttributeValues: { ":s": sessionId },
        ScanIndexForward: true,
        Limit: 500,
      }),
    );
    return (out.Items ?? [])
      .map((row) => stripSegment(row))
      .filter((seg) => seg.agencyId === agencyId);
  },

  async incrementSegmentCount(agencyId: string, sessionId: string): Promise<void> {
    const now = new Date().toISOString();
    await ddb.send(
      new UpdateCommand({
        TableName: sessionsTable(),
        Key: { pk: sessionPk(agencyId, sessionId), sk: SESSION_SK },
        UpdateExpression:
          "SET segmentCount = if_not_exists(segmentCount, :z) + :one, updatedAt = :u",
        ExpressionAttributeValues: { ":z": 0, ":one": 1, ":u": now },
      }),
    );
  },

  async putConnection(row: TranslateConnectionRecord): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: connectionsTable(),
        Item: row,
      }),
    );
  },

  async getConnection(connectionId: string): Promise<TranslateConnectionRecord | null> {
    const out = await ddb.send(
      new GetCommand({
        TableName: connectionsTable(),
        Key: { connectionId },
      }),
    );
    return (out.Item as TranslateConnectionRecord | undefined) ?? null;
  },

  async deleteConnection(connectionId: string): Promise<void> {
    await ddb.send(
      new DeleteCommand({
        TableName: connectionsTable(),
        Key: { connectionId },
      }),
    );
  },

  async listConnections(sessionId: string): Promise<TranslateConnectionRecord[]> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: connectionsTable(),
        IndexName: "bySession",
        KeyConditionExpression: "sessionId = :s",
        ExpressionAttributeValues: { ":s": sessionId },
      }),
    );
    return (out.Items ?? []) as TranslateConnectionRecord[];
  },
};
