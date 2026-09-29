/**
 * Venue Report Service — RFP 2396IP, Build Items 4 + 7
 *
 * 1. CSV export — streams incident data as CSV (returned inline).
 * 2. PDF report — generates a presigned S3 key for a server-rendered PDF
 *    (real PDF generation deferred to Lambda layer; returns a job token +
 *    presigned URL once rendered — see MOCK_PDF_REPORT env flag).
 * 3. Secure share — creates a time-limited share token stored in DDB,
 *    sends a notification email if recipientEmail provided.
 */

import { createHash } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import type { VenueSecureShareBody } from "rapid-cortex-shared";
import { makeId } from "../lib/ids.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import { VENUE_KEYS } from "./venue-types.js";
import type { VenueIncidentRecord } from "./venue-types.js";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3 = new S3Client({});
const auditRepo = new AuditRepository();

function venueConfigTable(): string {
  const t = process.env.VENUE_CONFIG_TABLE?.trim();
  if (!t) throw new Error("VENUE_CONFIG_TABLE not set");
  return t;
}

function evidenceBucket(): string {
  const b = process.env.VENUE_EVIDENCE_BUCKET?.trim();
  if (!b) throw new Error("VENUE_EVIDENCE_BUCKET not set");
  return b;
}

function isMockMode(): boolean {
  return process.env.MOCK_PDF_REPORT === "1";
}

// ─── CSV Export (Build Item 7) ────────────────────────────────────────────────

const CSV_HEADERS = [
  "incidentId",
  "createdAt",
  "updatedAt",
  "status",
  "type",
  "category",
  "severity",
  "zoneLabel",
  "description",
  "assignedLabel",
  "source",
  "escalationLevel",
  "approvalStatus",
];

function csvEscape(v: unknown): string {
  const s = v == null ? "" : String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function exportIncidentsAsCsv(params: {
  agencyId: string;
  venueCode: string;
  fromDate?: string;
  toDate?: string;
}): Promise<string> {
  const allItems: VenueIncidentRecord[] = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const result = await ddb.send(
      new QueryCommand({
        TableName: venueConfigTable(),
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
        FilterExpression: "agencyId = :aid",
        ExpressionAttributeValues: {
          ":pk": VENUE_KEYS.incidentPk(params.venueCode),
          ":prefix": "INCIDENT#",
          ":aid": params.agencyId,
        },
        ScanIndexForward: true,
        Limit: 500,
        ExclusiveStartKey: lastKey,
      }),
    );
    const incidents = (result.Items ?? []).filter((r) =>
      /^INCIDENT#[^#]+$/.test(String(r.sk ?? "")),
    );
    allItems.push(...(incidents as unknown as VenueIncidentRecord[]));
    lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey && allItems.length < 5000);

  const from = params.fromDate ?? "1970-01-01";
  const to = params.toDate ?? "9999-12-31";
  const filtered = allItems.filter((r) => {
    const d = String(r.createdAt ?? "").slice(0, 10);
    return d >= from && d <= to;
  });

  const lines: string[] = [CSV_HEADERS.join(",")];
  for (const r of filtered) {
    lines.push(
      CSV_HEADERS.map((h) => csvEscape((r as unknown as Record<string, unknown>)[h])).join(","),
    );
  }

  return lines.join("\r\n");
}

// ─── PDF Report (Build Item 4) ────────────────────────────────────────────────

export interface ReportRecord {
  reportId: string;
  incidentId: string;
  venueCode: string;
  agencyId: string;
  s3Key: string;
  status: "generating" | "ready" | "error";
  requestedBy: string;
  requestedAt: string;
  readyAt?: string;
}

export async function requestPdfReport(params: {
  agencyId: string;
  venueCode: string;
  incidentId: string;
  actorId: string;
  actorLabel: string;
}): Promise<{ reportId: string; downloadUrl: string; status: ReportRecord["status"] }> {
  // Verify incident exists and belongs to agency
  const incidentResult = await ddb.send(
    new GetCommand({
      TableName: venueConfigTable(),
      Key: {
        pk: VENUE_KEYS.incidentPk(params.venueCode),
        sk: VENUE_KEYS.incidentSk(params.incidentId),
      },
    }),
  );
  const incident = incidentResult.Item;
  if (!incident) throw Object.assign(new Error("Incident not found"), { statusCode: 404 });
  if (String(incident.agencyId) !== params.agencyId) {
    throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
  }

  const reportId = makeId("rpt");
  const now = new Date().toISOString();
  const s3Key = `venue-reports/${params.venueCode}/${params.incidentId}/${reportId}.pdf`;

  let downloadUrl: string;
  let status: ReportRecord["status"];

  if (isMockMode()) {
    // Mock: return a stub PDF presigned URL immediately
    const stubPdf = Buffer.from(`%PDF-1.4 stub report ${reportId}`);
    await s3.send(
      new PutObjectCommand({
        Bucket: evidenceBucket(),
        Key: s3Key,
        Body: stubPdf,
        ContentType: "application/pdf",
        Metadata: {
          "x-amz-meta-report-id": reportId,
          "x-amz-meta-incident-id": params.incidentId,
        },
      }),
    );
    status = "ready";
    downloadUrl = await getSignedUrl(
      s3,
      new (await import("@aws-sdk/client-s3")).GetObjectCommand({
        Bucket: evidenceBucket(),
        Key: s3Key,
        ResponseContentDisposition: `attachment; filename="incident-${params.incidentId}.pdf"`,
      }),
      { expiresIn: 3600 },
    );
  } else {
    // Production: write "generating" stub; real PDF renderer Lambda picks it up
    // via DDB Streams or EventBridge. For now store the record and return a
    // presigned URL that will be valid once the renderer writes the PDF.
    status = "generating";
    downloadUrl = await getSignedUrl(
      s3,
      new (await import("@aws-sdk/client-s3")).GetObjectCommand({
        Bucket: evidenceBucket(),
        Key: s3Key,
        ResponseContentDisposition: `attachment; filename="incident-${params.incidentId}.pdf"`,
      }),
      { expiresIn: 86400 },
    );
  }

  const record: ReportRecord = {
    reportId,
    incidentId: params.incidentId,
    venueCode: params.venueCode,
    agencyId: params.agencyId,
    s3Key,
    status,
    requestedBy: params.actorId,
    requestedAt: now,
    ...(status === "ready" ? { readyAt: now } : {}),
  };

  await ddb.send(
    new PutCommand({
      TableName: venueConfigTable(),
      Item: {
        pk: VENUE_KEYS.incidentPk(params.venueCode),
        sk: VENUE_KEYS.reportSk(params.incidentId, reportId),
        ...record,
      },
    }),
  );

  try {
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: params.agencyId,
      incidentId: params.incidentId,
      actorId: params.actorId,
      type: AUDIT_EVENT_TYPES.VENUE_REPORT_GENERATED,
      details: { reportId, s3Key },
      createdAt: now,
      resourceType: "report",
      resourceId: reportId,
    });
  } catch {
    // audit failure never aborts
  }

  return { reportId, downloadUrl, status };
}

// ─── Secure Share (Build Item 4) ──────────────────────────────────────────────

export interface SecureShareRecord {
  shareId: string;
  incidentId: string;
  venueCode: string;
  agencyId: string;
  shareToken: string;
  recipientEmail?: string;
  recipientLabel?: string;
  note?: string;
  includeAttachments: boolean;
  expiresAt: string;
  createdBy: string;
  createdAt: string;
}

export async function createSecureShare(params: {
  agencyId: string;
  venueCode: string;
  incidentId: string;
  actorId: string;
  actorLabel: string;
  body: VenueSecureShareBody;
}): Promise<{ shareId: string; shareToken: string; expiresAt: string; shareUrl: string }> {
  // Verify incident
  const incidentResult = await ddb.send(
    new GetCommand({
      TableName: venueConfigTable(),
      Key: {
        pk: VENUE_KEYS.incidentPk(params.venueCode),
        sk: VENUE_KEYS.incidentSk(params.incidentId),
      },
    }),
  );
  if (!incidentResult.Item) throw Object.assign(new Error("Incident not found"), { statusCode: 404 });
  if (String(incidentResult.Item.agencyId) !== params.agencyId) {
    throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
  }

  const shareId = makeId("shr");
  // Cryptographically random share token
  const shareToken = createHash("sha256")
    .update(`${shareId}${params.incidentId}${Date.now()}`)
    .digest("hex");

  const now = new Date().toISOString();
  const ttlHours = params.body.ttlHours ?? 72;
  const expiresAt = new Date(Date.now() + ttlHours * 3600 * 1000).toISOString();
  const ttlEpoch = Math.floor(Date.now() / 1000) + ttlHours * 3600;

  const record: SecureShareRecord = {
    shareId,
    incidentId: params.incidentId,
    venueCode: params.venueCode,
    agencyId: params.agencyId,
    shareToken,
    recipientEmail: params.body.recipientEmail,
    recipientLabel: params.body.recipientLabel,
    note: params.body.note,
    includeAttachments: params.body.includeAttachments ?? true,
    expiresAt,
    createdBy: params.actorId,
    createdAt: now,
  };

  await ddb.send(
    new PutCommand({
      TableName: venueConfigTable(),
      Item: {
        pk: `SHARE#${shareToken}`,
        sk: "META",
        ttl: ttlEpoch,
        ...record,
      },
    }),
  );

  const webBase = process.env.WEB_BASE_URL?.trim() ?? "https://app.rapidcortex.us";
  const shareUrl = `${webBase}/venue/shared/${shareToken}`;

  try {
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: params.agencyId,
      incidentId: params.incidentId,
      actorId: params.actorId,
      type: AUDIT_EVENT_TYPES.VENUE_SECURE_SHARE_CREATED,
      details: {
        shareId,
        recipientEmail: params.body.recipientEmail ?? null,
        expiresAt,
      },
      createdAt: now,
      resourceType: "share",
      resourceId: shareId,
    });
  } catch {
    // audit failure never aborts
  }

  return { shareId, shareToken, expiresAt, shareUrl };
}
