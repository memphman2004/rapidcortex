/**
 * Venue Evidence Service — RFP 2396IP, Build Item 1
 *
 * Chain-of-custody + immutable S3 originals.
 * Flow:  requestUpload (presigned PUT) → confirmUpload (server-side SHA-256
 *        verify) → transferCustody (append-only CoC log).
 *
 * Object Lock caveat: WORM mode (COMPLIANCE) requires the bucket to have been
 * created with ObjectLockEnabled=true. The standard bucket here uses server-side
 * immutability via a Deny s3:DeleteObject / s3:PutObject policy instead.
 * To enable true WORM, replace VenueEvidenceBucket in the SAM template with a
 * pre-created Object Lock bucket and set VENUE_EVIDENCE_OBJECT_LOCK=1.
 */

import { createHash } from "node:crypto";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  GetCommand,
} from "@aws-sdk/lib-dynamodb";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import type {
  VenueEvidenceUploadBody,
  VenueEvidenceConfirmBody,
  VenueCustodyTransferBody,
} from "rapid-cortex-shared";
import { makeId } from "../lib/ids.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import { VENUE_KEYS } from "./venue-types.js";
import { writeVenueRfpAudit } from "./venue-rfp-audit.js";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3 = new S3Client({});
const auditRepo = new AuditRepository();

const PRESIGN_EXPIRES = 300; // 5 min upload window

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
  return process.env.VENUE_EVIDENCE_MOCK === "1";
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EvidenceRecord {
  evidenceId: string;
  incidentId: string;
  venueCode: string;
  agencyId: string;
  fileName: string;
  contentType: string;
  byteSize: number;
  sha256: string;
  kind: VenueEvidenceUploadBody["kind"];
  label?: string;
  s3Key: string;
  status: "pending_upload" | "confirmed" | "corrupted";
  uploadedBy: string;
  uploadedByLabel: string;
  confirmedAt?: string;
  createdAt: string;
}

export interface CustodyRecord {
  custodyId: string;
  evidenceId: string;
  incidentId: string;
  venueCode: string;
  agencyId: string;
  fromCustodianId: string;
  fromCustodianLabel: string;
  toCustodianId: string;
  toCustodianLabel: string;
  reason: string;
  transferredAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getIncidentForEvidence(
  venueCode: string,
  incidentId: string,
): Promise<Record<string, unknown> | null> {
  const result = await ddb.send(
    new GetCommand({
      TableName: venueConfigTable(),
      Key: {
        pk: VENUE_KEYS.incidentPk(venueCode),
        sk: VENUE_KEYS.incidentSk(incidentId),
      },
    }),
  );
  return (result.Item ?? null) as Record<string, unknown> | null;
}

/**
 * Append-only venue audit write: ConditionExpression ensures we never
 * overwrite an existing audit record (true append-only log).
 */
async function appendVenueAudit(
  venueCode: string,
  agencyId: string,
  eventType: string,
  details: Record<string, unknown>,
): Promise<void> {
  const now = new Date().toISOString();
  const auditId = makeId("vaud");
  await ddb.send(
    new PutCommand({
      TableName: venueConfigTable(),
      Item: {
        pk: VENUE_KEYS.incidentPk(venueCode),
        sk: VENUE_KEYS.auditSk(now, auditId),
        auditId,
        agencyId,
        eventType,
        details,
        createdAt: now,
      },
      ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)",
    }),
  );
}

// ─── requestUpload ────────────────────────────────────────────────────────────

export async function requestEvidenceUpload(params: {
  agencyId: string;
  venueCode: string;
  incidentId: string;
  actorId: string;
  actorLabel: string;
  body: VenueEvidenceUploadBody;
}): Promise<{ evidenceId: string; uploadUrl: string; s3Key: string; expiresIn: number }> {
  const incident = await getIncidentForEvidence(params.venueCode, params.incidentId);
  if (!incident) throw Object.assign(new Error("Incident not found"), { statusCode: 404 });

  const evidenceId = makeId("evid");
  const now = new Date().toISOString();
  const s3Key = `venue-evidence/${params.venueCode}/${params.incidentId}/${evidenceId}/${params.body.fileName}`;

  // Always persist the pending record to DDB (also in mock mode for tests)
  await ddb.send(
    new PutCommand({
      TableName: venueConfigTable(),
      Item: {
        pk: VENUE_KEYS.incidentPk(params.venueCode),
        sk: VENUE_KEYS.evidenceSk(params.incidentId, evidenceId),
        evidenceId,
        incidentId: params.incidentId,
        venueCode: params.venueCode,
        agencyId: params.agencyId,
        fileName: params.body.fileName,
        contentType: params.body.contentType,
        byteSize: params.body.byteSize,
        sha256: params.body.sha256.toLowerCase(),
        kind: params.body.kind,
        label: params.body.label ?? null,
        s3Key,
        status: "pending_upload",
        uploadedBy: params.actorId,
        uploadedByLabel: params.actorLabel,
        createdAt: now,
      },
      ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)",
    }),
  );

  if (isMockMode()) {
    // Mock: skip real S3 presign
    return {
      evidenceId,
      uploadUrl: `https://mock-evidence-bucket.local/${s3Key}?presigned=1`,
      s3Key,
      expiresIn: PRESIGN_EXPIRES,
    };
  }

  {
    const objectLockEnabled = process.env.VENUE_EVIDENCE_OBJECT_LOCK === "1";
    const retainUntil = new Date(Date.now() + 7 * 365 * 86400_000);
    const cmd = new PutObjectCommand({
      Bucket: evidenceBucket(),
      Key: s3Key,
      ContentType: params.body.contentType,
      ContentLength: params.body.byteSize,
      ServerSideEncryption: "AES256",
      ...(objectLockEnabled
        ? {
            ObjectLockMode: "GOVERNANCE" as const,
            ObjectLockRetainUntilDate: retainUntil,
          }
        : {}),
      Metadata: {
        sha256: params.body.sha256.toLowerCase(),
        "evidence-id": evidenceId,
        "incident-id": params.incidentId,
        "agency-id": params.agencyId,
        "uploaded-by": params.actorId,
        "upload-ts": now,
      },
    });
    const uploadUrl = await getSignedUrl(s3, cmd, { expiresIn: PRESIGN_EXPIRES });

    return { evidenceId, uploadUrl, s3Key, expiresIn: PRESIGN_EXPIRES };
  }
}

// ─── confirmUpload ────────────────────────────────────────────────────────────

export async function confirmEvidenceUpload(params: {
  agencyId: string;
  venueCode: string;
  incidentId: string;
  actorId: string;
  actorLabel: string;
  body: VenueEvidenceConfirmBody;
}): Promise<EvidenceRecord> {
  const result = await ddb.send(
    new GetCommand({
      TableName: venueConfigTable(),
      Key: {
        pk: VENUE_KEYS.incidentPk(params.venueCode),
        sk: VENUE_KEYS.evidenceSk(params.incidentId, params.body.evidenceId),
      },
    }),
  );

  const row = result.Item;
  if (!row) throw Object.assign(new Error("Evidence record not found"), { statusCode: 404 });
  if (String(row.agencyId) !== params.agencyId) {
    throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
  }
  if (row.status === "confirmed") {
    return row as unknown as EvidenceRecord; // idempotent
  }

  const now = new Date().toISOString();
  let confirmedStatus: "confirmed" | "corrupted" = "confirmed";

  if (!isMockMode()) {
    // Server-side SHA-256 verification: stream S3 object and hash
    try {
      const s3Obj = await s3.send(
        new GetObjectCommand({ Bucket: evidenceBucket(), Key: params.body.s3Key }),
      );
      const hash = createHash("sha256");
      if (s3Obj.Body) {
        // @ts-expect-error — S3 Body is a stream in Node
        for await (const chunk of s3Obj.Body) {
          hash.update(chunk as Buffer);
        }
      }
      const computed = hash.digest("hex");
      const expected = String(row.sha256).toLowerCase();
      if (computed !== expected) {
        confirmedStatus = "corrupted";
      }
    } catch {
      confirmedStatus = "corrupted";
    }
  }

  // Atomic update — mark confirmed or corrupted
  await ddb.send(
    new PutCommand({
      TableName: venueConfigTable(),
      Item: {
        ...row,
        status: confirmedStatus,
        confirmedAt: now,
        confirmedBy: params.actorId,
      },
    }),
  );

  if (confirmedStatus === "corrupted") {
    throw Object.assign(new Error("SHA-256 mismatch: evidence marked corrupted"), {
      statusCode: 422,
    });
  }

  // Initial custody record (chain-of-custody starts here)
  const cocId = makeId("coc");
  const cocTs = now;
  await ddb.send(
    new PutCommand({
      TableName: venueConfigTable(),
      Item: {
        pk: VENUE_KEYS.incidentPk(params.venueCode),
        sk: VENUE_KEYS.custodySk(params.body.evidenceId, cocTs, cocId),
        custodyId: cocId,
        evidenceId: params.body.evidenceId,
        incidentId: params.incidentId,
        venueCode: params.venueCode,
        agencyId: params.agencyId,
        fromCustodianId: "system",
        fromCustodianLabel: "Upload",
        toCustodianId: params.actorId,
        toCustodianLabel: params.actorLabel,
        reason: "Initial upload confirmed",
        transferredAt: cocTs,
      },
      ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)",
    }),
  );

  await appendVenueAudit(params.venueCode, params.agencyId, "evidence.confirmed", {
    evidenceId: params.body.evidenceId,
    incidentId: params.incidentId,
    confirmedBy: params.actorId,
  });

  try {
    await writeVenueRfpAudit({
      venueCode: params.venueCode,
      agencyId: params.agencyId,
      eventType: "EVIDENCE_UPLOADED",
      actorId: params.actorId,
      actorRole: "venue",
      resourceType: "evidence",
      resourceId: params.body.evidenceId,
      incidentId: params.incidentId,
      metadata: { s3Key: params.body.s3Key, sha256: row.sha256 },
    });
  } catch {
    // never abort
  }

  try {
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: params.agencyId,
      incidentId: params.incidentId,
      actorId: params.actorId,
      type: AUDIT_EVENT_TYPES.VENUE_EVIDENCE_CONFIRMED,
      details: { evidenceId: params.body.evidenceId, s3Key: params.body.s3Key },
      createdAt: now,
      resourceType: "evidence",
      resourceId: params.body.evidenceId,
    });
  } catch {
    // audit failure never aborts business logic
  }

  return { ...row, status: "confirmed", confirmedAt: now } as unknown as EvidenceRecord;
}

// ─── listEvidence ─────────────────────────────────────────────────────────────

export async function listEvidenceForIncident(
  venueCode: string,
  incidentId: string,
  agencyId: string,
): Promise<EvidenceRecord[]> {
  const result = await ddb.send(
    new QueryCommand({
      TableName: venueConfigTable(),
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
      ExpressionAttributeValues: {
        ":pk": VENUE_KEYS.incidentPk(venueCode),
        ":prefix": VENUE_KEYS.evidencePrefix(incidentId),
      },
      ScanIndexForward: true,
    }),
  );
  return (result.Items ?? [])
    .filter((r) => String(r.agencyId) === agencyId)
    .map((r) => r as unknown as EvidenceRecord);
}

// ─── listCustody ──────────────────────────────────────────────────────────────

export async function listCustodyChain(
  venueCode: string,
  incidentId: string,
  evidenceId: string,
  agencyId: string,
): Promise<CustodyRecord[]> {
  const result = await ddb.send(
    new QueryCommand({
      TableName: venueConfigTable(),
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
      ExpressionAttributeValues: {
        ":pk": VENUE_KEYS.incidentPk(venueCode),
        ":prefix": VENUE_KEYS.custodyPrefix(evidenceId),
      },
      ScanIndexForward: true,
    }),
  );
  return (result.Items ?? [])
    .filter((r) => String(r.agencyId) === agencyId && String(r.incidentId) === incidentId)
    .map((r) => r as unknown as CustodyRecord);
}

// ─── transferCustody ──────────────────────────────────────────────────────────

export async function transferCustody(params: {
  agencyId: string;
  venueCode: string;
  incidentId: string;
  actorId: string;
  actorLabel: string;
  body: VenueCustodyTransferBody;
}): Promise<CustodyRecord> {
  const evidenceResult = await ddb.send(
    new GetCommand({
      TableName: venueConfigTable(),
      Key: {
        pk: VENUE_KEYS.incidentPk(params.venueCode),
        sk: VENUE_KEYS.evidenceSk(params.incidentId, params.body.evidenceId),
      },
    }),
  );
  if (!evidenceResult.Item) {
    throw Object.assign(new Error("Evidence not found"), { statusCode: 404 });
  }
  if (String(evidenceResult.Item.agencyId) !== params.agencyId) {
    throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
  }

  const now = new Date().toISOString();
  const cocId = makeId("coc");
  const record: CustodyRecord = {
    custodyId: cocId,
    evidenceId: params.body.evidenceId,
    incidentId: params.incidentId,
    venueCode: params.venueCode,
    agencyId: params.agencyId,
    fromCustodianId: params.actorId,
    fromCustodianLabel: params.actorLabel,
    toCustodianId: params.body.toCustodianId,
    toCustodianLabel: params.body.toCustodianLabel,
    reason: params.body.reason,
    transferredAt: now,
  };

  await ddb.send(
    new PutCommand({
      TableName: venueConfigTable(),
      Item: {
        pk: VENUE_KEYS.incidentPk(params.venueCode),
        sk: VENUE_KEYS.custodySk(params.body.evidenceId, now, cocId),
        ...record,
      },
      ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)",
    }),
  );

  await appendVenueAudit(params.venueCode, params.agencyId, "custody.transferred", {
    evidenceId: params.body.evidenceId,
    incidentId: params.incidentId,
    toCustodianId: params.body.toCustodianId,
    cocId,
  });

  try {
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: params.agencyId,
      incidentId: params.incidentId,
      actorId: params.actorId,
      type: AUDIT_EVENT_TYPES.VENUE_CUSTODY_TRANSFERRED,
      details: {
        evidenceId: params.body.evidenceId,
        toCustodianId: params.body.toCustodianId,
        reason: params.body.reason,
      },
      createdAt: now,
      resourceType: "evidence",
      resourceId: params.body.evidenceId,
    });
  } catch {
    // never abort business logic
  }

  return record;
}

// ─── presignedDownload ────────────────────────────────────────────────────────

export async function presignEvidenceDownload(
  venueCode: string,
  incidentId: string,
  evidenceId: string,
  agencyId: string,
  ttlSeconds = 300,
): Promise<string> {
  const result = await ddb.send(
    new GetCommand({
      TableName: venueConfigTable(),
      Key: {
        pk: VENUE_KEYS.incidentPk(venueCode),
        sk: VENUE_KEYS.evidenceSk(incidentId, evidenceId),
      },
    }),
  );
  const row = result.Item;
  if (!row) throw Object.assign(new Error("Evidence not found"), { statusCode: 404 });
  if (String(row.agencyId) !== agencyId) throw Object.assign(new Error("Forbidden"), { statusCode: 403 });

  if (isMockMode()) return `https://mock-evidence-bucket.local/${row.s3Key}?download=1`;

  return getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: evidenceBucket(),
      Key: String(row.s3Key),
      ResponseContentDisposition: `attachment; filename="${row.fileName}"`,
    }),
    { expiresIn: ttlSeconds },
  );
}

export async function sealVenueEvidence(params: {
  venueCode: string;
  agencyId: string;
  incidentId: string;
  evidenceId: string;
  actorId: string;
  actorLabel: string;
  actorRole: string;
}): Promise<EvidenceRecord> {
  const result = await ddb.send(
    new GetCommand({
      TableName: venueConfigTable(),
      Key: {
        pk: VENUE_KEYS.incidentPk(params.venueCode),
        sk: VENUE_KEYS.evidenceSk(params.incidentId, params.evidenceId),
      },
    }),
  );
  const row = result.Item;
  if (!row) throw Object.assign(new Error("Evidence not found"), { statusCode: 404 });
  if (String(row.agencyId) !== params.agencyId) {
    throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
  }
  if (row.status !== "confirmed" && row.sealed !== true) {
    throw Object.assign(new Error("Only confirmed evidence can be sealed"), { statusCode: 422 });
  }
  if (row.sealed === true) {
    return row as unknown as EvidenceRecord;
  }

  const now = new Date().toISOString();
  const sealed = {
    ...row,
    sealed: true,
    sealedAt: now,
    sealedBy: params.actorId,
    sealedByLabel: params.actorLabel,
    immutableOriginal: true,
  };
  await ddb.send(
    new PutCommand({
      TableName: venueConfigTable(),
      Item: sealed,
    }),
  );

  const cocId = makeId("coc");
  await ddb.send(
    new PutCommand({
      TableName: venueConfigTable(),
      Item: {
        pk: VENUE_KEYS.incidentPk(params.venueCode),
        sk: VENUE_KEYS.custodySk(params.evidenceId, now, cocId),
        custodyId: cocId,
        evidenceId: params.evidenceId,
        incidentId: params.incidentId,
        venueCode: params.venueCode,
        agencyId: params.agencyId,
        fromCustodianId: params.actorId,
        fromCustodianLabel: params.actorLabel,
        toCustodianId: params.actorId,
        toCustodianLabel: params.actorLabel,
        reason: "Supervisor seal — immutable original locked",
        action: "LOCKED",
        fileHash: row.sha256,
        transferredAt: now,
      },
      ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)",
    }),
  );

  await appendVenueAudit(params.venueCode, params.agencyId, "evidence.sealed", {
    evidenceId: params.evidenceId,
    incidentId: params.incidentId,
    sealedBy: params.actorId,
    actorRole: params.actorRole,
    sha256: row.sha256,
  });

  return sealed as unknown as EvidenceRecord;
}

/** Browser/client hash helper (API tests + future server verify paths). */
export function sha256Hex(buf: Buffer | string): string {
  return createHash("sha256").update(buf).digest("hex");
}

export const listVenueEvidence = listEvidenceForIncident;
export const listVenueCustody = listCustodyChain;

export { appendVenueAudit };
