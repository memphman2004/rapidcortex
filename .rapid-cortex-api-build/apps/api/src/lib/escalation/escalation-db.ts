import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type {
  AgencyRelationship,
  EscalationAuditEntry,
  EscalationRecord,
  EscalationStatus,
} from "rapid-cortex-shared";
import { ddb } from "../../repositories/baseRepository.js";
import { env } from "../env.js";
import { makeId } from "../ids.js";

function escalationsTable(): string {
  if (!env.escalationsTable) throw new Error("Missing required env var: ESCALATIONS_TABLE");
  return env.escalationsTable;
}
function auditTable(): string {
  if (!env.escalationAuditTable) throw new Error("Missing required env var: ESCALATION_AUDIT_TABLE");
  return env.escalationAuditTable;
}
function relationshipsTable(): string {
  if (!env.agencyRelationshipsTable) {
    throw new Error("Missing required env var: AGENCY_RELATIONSHIPS_TABLE");
  }
  return env.agencyRelationshipsTable;
}

export async function appendAuditEvent(
  entry: Omit<EscalationAuditEntry, "eventId"> & { eventId?: string },
): Promise<EscalationAuditEntry> {
  const full: EscalationAuditEntry = {
    ...entry,
    eventId: entry.eventId ?? makeId("esc-evt"),
  };
  await ddb.send(
    new PutCommand({
      TableName: auditTable(),
      Item: {
        pk: `ESCALATION#${full.escalationId}`,
        sk: `EVENT#${full.occurredAt}#${full.eventId}`,
        ...full,
      },
    }),
  );
  return full;
}

export async function listAuditEvents(escalationId: string): Promise<EscalationAuditEntry[]> {
  const res = await ddb.send(
    new QueryCommand({
      TableName: auditTable(),
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
      ExpressionAttributeValues: {
        ":pk": `ESCALATION#${escalationId}`,
        ":sk": "EVENT#",
      },
    }),
  );
  return (res.Items ?? []) as EscalationAuditEntry[];
}

export async function putEscalation(record: EscalationRecord): Promise<void> {
  const table = escalationsTable();
  await ddb.send(
    new PutCommand({
      TableName: table,
      Item: {
        pk: `ESCALATION#${record.escalationId}`,
        sk: "RECORD",
        gsi1pk: `SOURCE#${record.sourceAgencyId}`,
        gsi1sk: `TIME#${record.escalatedAt}`,
        gsi2pk: `TARGET#${record.targetAgencyId}`,
        gsi2sk: `STATUS#${record.status}#${record.escalatedAt}`,
        ...record,
      },
    }),
  );
  await ddb.send(
    new PutCommand({
      TableName: table,
      Item: {
        pk: `VIEWER#${record.viewerToken}`,
        sk: "ESCALATION",
        escalationId: record.escalationId,
      },
    }),
  );
}

export async function getEscalation(escalationId: string): Promise<EscalationRecord | null> {
  const res = await ddb.send(
    new GetCommand({
      TableName: escalationsTable(),
      Key: { pk: `ESCALATION#${escalationId}`, sk: "RECORD" },
    }),
  );
  return (res.Item as EscalationRecord | undefined) ?? null;
}

export async function getEscalationByViewerToken(token: string): Promise<EscalationRecord | null> {
  const pointer = await ddb.send(
    new GetCommand({
      TableName: escalationsTable(),
      Key: { pk: `VIEWER#${token}`, sk: "ESCALATION" },
    }),
  );
  const escalationId = pointer.Item?.escalationId;
  if (typeof escalationId !== "string") return null;
  return getEscalation(escalationId);
}

export async function recordViewerAccess(opts: {
  escalationId: string;
  ip?: string;
}): Promise<void> {
  const now = new Date().toISOString();
  await ddb.send(
    new UpdateCommand({
      TableName: escalationsTable(),
      Key: { pk: `ESCALATION#${opts.escalationId}`, sk: "RECORD" },
      UpdateExpression:
        "SET viewerAccessCount = if_not_exists(viewerAccessCount, :z) + :one, viewerLastAccessedAt = :now, viewerLastAccessedIp = :ip",
      ExpressionAttributeValues: {
        ":z": 0,
        ":one": 1,
        ":now": now,
        ":ip": opts.ip ?? "unknown",
      },
    }),
  );
  await appendAuditEvent({
    escalationId: opts.escalationId,
    eventType: "escalation.viewer.accessed",
    occurredAt: now,
    actor: opts.ip ? `anonymous:${opts.ip}` : "anonymous",
  });
}

export async function listEscalationsBySource(sourceAgencyId: string): Promise<EscalationRecord[]> {
  const res = await ddb.send(
    new QueryCommand({
      TableName: escalationsTable(),
      IndexName: "gsi1-source-time",
      KeyConditionExpression: "gsi1pk = :pk",
      ExpressionAttributeValues: { ":pk": `SOURCE#${sourceAgencyId}` },
      ScanIndexForward: false,
    }),
  );
  return (res.Items ?? []) as EscalationRecord[];
}

export async function listEscalationsByTarget(targetAgencyId: string): Promise<EscalationRecord[]> {
  const res = await ddb.send(
    new QueryCommand({
      TableName: escalationsTable(),
      IndexName: "gsi2-target-status",
      KeyConditionExpression: "gsi2pk = :pk",
      ExpressionAttributeValues: { ":pk": `TARGET#${targetAgencyId}` },
      ScanIndexForward: false,
    }),
  );
  return (res.Items ?? []) as EscalationRecord[];
}

export async function updateEscalationStatus(
  escalationId: string,
  status: EscalationStatus,
  actor: string,
  notes?: string,
): Promise<EscalationRecord> {
  const now = new Date().toISOString();
  const names: Record<string, string> = { "#st": "status" };
  const values: Record<string, unknown> = { ":st": status, ":now": now };
  let setExpr = "#st = :st";
  if (status === "acknowledged") {
    setExpr += ", acknowledgedAt = :now, acknowledgedBy = :actor";
    values[":actor"] = actor;
  }
  if (status === "resolved") {
    setExpr += ", resolvedAt = :now, resolvedBy = :actor";
    values[":actor"] = actor;
  }
  if (notes !== undefined) {
    setExpr += ", notes = :notes";
    values[":notes"] = notes;
  }
  await ddb.send(
    new UpdateCommand({
      TableName: escalationsTable(),
      Key: { pk: `ESCALATION#${escalationId}`, sk: "RECORD" },
      UpdateExpression: `SET ${setExpr}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    }),
  );
  await appendAuditEvent({
    escalationId,
    eventType: `escalation.status.${status}`,
    occurredAt: now,
    actor,
    metadata: notes ? { notes } : undefined,
  });
  const updated = await getEscalation(escalationId);
  if (!updated) throw new Error("Escalation not found after update");
  return updated;
}

export async function getRelationship(sourceAgencyId: string): Promise<AgencyRelationship | null> {
  const res = await ddb.send(
    new QueryCommand({
      TableName: relationshipsTable(),
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": `SOURCE#${sourceAgencyId}` },
      Limit: 1,
    }),
  );
  const item = res.Items?.[0];
  return (item as AgencyRelationship | undefined) ?? null;
}

export async function putRelationship(rel: AgencyRelationship): Promise<void> {
  await ddb.send(
    new PutCommand({
      TableName: relationshipsTable(),
      Item: {
        pk: `SOURCE#${rel.sourceAgencyId}`,
        sk: `TARGET#${rel.targetAgencyId}`,
        ...rel,
      },
    }),
  );
}
