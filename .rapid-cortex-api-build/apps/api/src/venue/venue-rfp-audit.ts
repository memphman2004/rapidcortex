/**
 * Append-only venue audit stream (RFP 2396IP).
 * Stored in VENUE_CONFIG_TABLE under pk=VENUE#{code}, sk=AUDIT#{ts}#{id}.
 * Overwrites are rejected via attribute_not_exists(pk) AND attribute_not_exists(sk).
 */
import { randomUUID } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { VENUE_KEYS } from "./venue-types.js";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

function venueConfigTable(): string {
  const t = process.env.VENUE_CONFIG_TABLE?.trim();
  if (!t) throw new Error("VENUE_CONFIG_TABLE not set");
  return t;
}

export type VenueRfpAuditEventType =
  | "INCIDENT_CREATED"
  | "INCIDENT_VIEWED"
  | "INCIDENT_UPDATED"
  | "INCIDENT_STATUS_CHANGED"
  | "INCIDENT_ASSIGNED"
  | "INCIDENT_ESCALATED"
  | "INCIDENT_APPROVED"
  | "INCIDENT_REJECTED"
  | "INCIDENT_CLOSED"
  | "INCIDENT_REOPENED"
  | "INCIDENT_LINKED"
  | "INCIDENT_EXPORTED"
  | "EVIDENCE_UPLOADED"
  | "EVIDENCE_VIEWED"
  | "EVIDENCE_DOWNLOADED"
  | "EVIDENCE_SHARED"
  | "EVIDENCE_LOCKED"
  | "EVIDENCE_CUSTODY_TRANSFER"
  | "REPORT_GENERATED"
  | "REPORT_DISTRIBUTED"
  | "FORM_SCHEMA_UPDATED"
  | "IMPORT_RUN"
  | "USER_LOGIN"
  | "USER_LOGOUT"
  | "USER_ROLE_CHANGED";

export type VenueRfpAuditWrite = {
  venueCode: string;
  agencyId: string;
  eventType: VenueRfpAuditEventType;
  actorId: string;
  actorRole: string;
  actorEmail?: string;
  ipAddress?: string;
  resourceType: "incident" | "evidence" | "case" | "report" | "user" | "system" | "form" | "import";
  resourceId: string;
  incidentId?: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
};

export type VenueRfpAuditRecord = VenueRfpAuditWrite & {
  pk: string;
  sk: string;
  gsi1pk: string;
  gsi1sk: string;
  gsi2pk?: string;
  gsi2sk?: string;
  timestamp: string;
};

export async function writeVenueRfpAudit(event: VenueRfpAuditWrite): Promise<VenueRfpAuditRecord> {
  const ts = new Date().toISOString();
  const id = randomUUID().slice(0, 8);
  const venueCode = event.venueCode.toUpperCase();
  const record: VenueRfpAuditRecord = {
    ...event,
    venueCode,
    pk: VENUE_KEYS.incidentPk(venueCode),
    sk: VENUE_KEYS.auditSk(ts, id),
    gsi1pk: `ACTOR#${event.actorId}`,
    gsi1sk: ts,
    gsi2pk: event.incidentId ? `INCIDENT#${event.incidentId}` : undefined,
    gsi2sk: event.incidentId ? ts : undefined,
    timestamp: ts,
    before: event.before ?? null,
    after: event.after ?? null,
    metadata: event.metadata ?? {},
  };

  try {
    await ddb.send(
      new PutCommand({
        TableName: venueConfigTable(),
        Item: record,
        ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)",
      }),
    );
  } catch (err) {
    // Never abort business logic on audit failure — log and continue.
    console.error("[venue-rfp-audit] write failed", {
      eventType: event.eventType,
      resourceId: event.resourceId,
      err: err instanceof Error ? err.message : String(err),
    });
  }
  return record;
}

export async function listVenueRfpAudit(params: {
  venueCode: string;
  incidentId?: string;
  limit?: number;
}): Promise<VenueRfpAuditRecord[]> {
  const venueCode = params.venueCode.toUpperCase();
  const limit = Math.min(Math.max(params.limit ?? 100, 1), 500);
  const result = await ddb.send(
    new QueryCommand({
      TableName: venueConfigTable(),
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
      ExpressionAttributeValues: {
        ":pk": VENUE_KEYS.incidentPk(venueCode),
        ":prefix": VENUE_KEYS.auditPrefix(),
      },
      ScanIndexForward: false,
      Limit: limit * 3,
    }),
  );
  let items = (result.Items ?? []) as VenueRfpAuditRecord[];
  if (params.incidentId) {
    items = items.filter(
      (row) => row.incidentId === params.incidentId || row.resourceId === params.incidentId,
    );
  }
  return items.slice(0, limit);
}
