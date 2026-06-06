import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { Handler } from "aws-lambda";
import type { AIAnalysis, Incident, TranscriptSegment } from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { env } from "../lib/env.js";
import { makeId } from "../lib/ids.js";
import { AnalysisRepository } from "../repositories/analysisRepository.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import { DataDeletionAuditRepository } from "../repositories/dataDeletionAuditRepository.js";
import { IncidentRepository } from "../repositories/incidentRepository.js";
import { IncidentMediaRepository } from "../repositories/incidentMediaRepository.js";
import { TranscriptRepository } from "../repositories/transcriptRepository.js";
import { RETENTION_GSI_PK } from "../lib/retentionPolicy.js";

const analysisRepo = new AnalysisRepository();
const auditRepo = new AuditRepository();
const dataDeletion = new DataDeletionAuditRepository();
const incidentRepo = new IncidentRepository();
const mediaRepo = new IncidentMediaRepository();
const transcriptRepo = new TranscriptRepository();
const s3 = new S3Client({});

const ACTOR = "system:retention-executor";
const pageSize = () => env.retentionPurgePageSize;

const incidentCache = new Map<string, Incident | null>();

async function getIncidentCached(incidentId: string): Promise<Incident | null> {
  if (incidentCache.has(incidentId)) return incidentCache.get(incidentId) ?? null;
  const i = await incidentRepo.get(incidentId);
  incidentCache.set(incidentId, i);
  return i;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function withRetry<T>(label: string, fn: () => Promise<T>, attempts = 3): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      const delay = 200 * 2 ** i;
      console.warn(JSON.stringify({ type: "retention.retry", label, attempt: i + 1, delay, error: String(e) }));
      await sleep(delay);
    }
  }
  throw last;
}

async function logDeletion(
  r: {
    agencyId: string;
    sourceTable: string;
    resourceType: "incident" | "transcript" | "analysis" | "incident_media";
    key: Record<string, unknown>;
    policyId: string;
    retentionPolicyId: string;
  },
) {
  const eventId = makeId("ddel");
  const deletedAt = new Date().toISOString();
  const resourceKeyJson = JSON.stringify(r.key);
  await withRetry("dataDeletion.append", () =>
    dataDeletion.append({
      eventId,
      agencyId: r.agencyId,
      sourceTable: r.sourceTable,
      resourceType: r.resourceType,
      resourceKeyJson,
      policyId: r.policyId,
      retentionPolicyId: r.retentionPolicyId,
      reason: "retention_expired",
      deletedAt,
      actorId: ACTOR,
    }),
  );
  await withRetry("audit.retention", () =>
    auditRepo.create({
      eventId: makeId("audit"),
      agencyId: r.agencyId,
      incidentId: typeof r.key.incidentId === "string" ? r.key.incidentId : undefined,
      actorId: ACTOR,
      type: AUDIT_EVENT_TYPES.RETENTION_RECORD_PURGED,
      details: {
        sourceTable: r.sourceTable,
        resourceType: r.resourceType,
        resourceKey: r.key,
        policyId: r.policyId,
        retentionPolicyId: r.retentionPolicyId,
        dataDeletionEventId: eventId,
      },
      createdAt: deletedAt,
      resourceType: "unknown",
      resourceId: eventId,
    }),
  );
}

export async function processRetentionPass(): Promise<{
  media: number;
  transcript: number;
  analysis: number;
  incident: number;
  errors: string[];
}> {
  if (!env.dataDeletionAuditTable) {
    throw new Error("DATA_DELETION_AUDIT_TABLE is required for retentionExecutor");
  }

  const errors: string[] = [];
  let mediaN = 0;
  let trN = 0;
  let anN = 0;
  let incN = 0;

  // 1) Media
  {
    let startKey: Record<string, unknown> | undefined;
    for (;;) {
      const { items, lastKey } = await mediaRepo.listRetentionDue(pageSize(), startKey);
      for (const row of items) {
        if (row.retGsiPk !== RETENTION_GSI_PK) continue;
        const inc = await getIncidentCached(row.incidentId);
        if (inc?.legalHold === true) continue;
        const policy = row.retentionPolicyId ?? env.defaultRetentionPolicyId;
        try {
          if (row.s3Key) {
            try {
              await s3.send(
                new DeleteObjectCommand({
                  Bucket: env.assetsBucket,
                  Key: row.s3Key,
                }),
              );
            } catch (e) {
              errors.push(`s3_delete:${row.s3Key}:${String(e)}`);
            }
          }
          await withRetry("media.delete", () => mediaRepo.delete(row.agencyId, row.mediaId));
          await logDeletion({
            agencyId: row.agencyId,
            sourceTable: env.incidentMediaTable || "incident_media",
            resourceType: "incident_media",
            key: { agencyId: row.agencyId, mediaId: row.mediaId, incidentId: row.incidentId },
            policyId: policy,
            retentionPolicyId: row.retentionPolicyId ?? policy,
          });
          mediaN += 1;
        } catch (e) {
          errors.push(`media:${row.mediaId}:${String(e)}`);
        }
      }
      if (!lastKey) break;
      startKey = lastKey;
    }
  }

  incidentCache.clear();

  // 2) Transcript segments
  {
    let startKey: Record<string, unknown> | undefined;
    for (;;) {
      const { items, lastKey } = await transcriptRepo.listRetentionDue(pageSize(), startKey);
      for (const row of items) {
        if (row.retGsiPk !== RETENTION_GSI_PK) continue;
        const inc = await getIncidentCached(row.incidentId);
        if (inc?.legalHold === true) continue;
        const seg = row as TranscriptSegment;
        const policy = row.retentionPolicyId ?? env.defaultRetentionPolicyId;
        try {
          await withRetry("transcript.delete", () => transcriptRepo.deleteSegment(row.incidentId, seg.timestamp));
          await logDeletion({
            agencyId: row.agencyId,
            sourceTable: env.transcriptsTable,
            resourceType: "transcript",
            key: { incidentId: row.incidentId, timestamp: seg.timestamp, segmentId: seg.segmentId },
            policyId: policy,
            retentionPolicyId: row.retentionPolicyId ?? policy,
          });
          trN += 1;
        } catch (e) {
          errors.push(`transcript:${row.incidentId}:${String(e)}`);
        }
      }
      if (!lastKey) break;
      startKey = lastKey;
    }
  }

  incidentCache.clear();

  // 3) Analyses
  {
    let startKey: Record<string, unknown> | undefined;
    for (;;) {
      const { items, lastKey } = await analysisRepo.listRetentionDue(pageSize(), startKey);
      for (const row of items) {
        if (row.retGsiPk !== RETENTION_GSI_PK) continue;
        const inc = await getIncidentCached(row.incidentId);
        if (inc?.legalHold === true) continue;
        const a = row as AIAnalysis;
        const policy = a.retentionPolicyId ?? env.defaultRetentionPolicyId;
        try {
          await withRetry("analysis.delete", () => analysisRepo.deleteOne(a.incidentId, a.createdAt));
          await logDeletion({
            agencyId: a.agencyId,
            sourceTable: env.analysesTable,
            resourceType: "analysis",
            key: { incidentId: a.incidentId, createdAt: a.createdAt, analysisId: a.analysisId },
            policyId: policy,
            retentionPolicyId: a.retentionPolicyId ?? policy,
          });
          anN += 1;
        } catch (e) {
          errors.push(`analysis:${a.analysisId}:${String(e)}`);
        }
      }
      if (!lastKey) break;
      startKey = lastKey;
    }
  }

  incidentCache.clear();

  // 4) Incidents (parent last; children processed in earlier passes when eligible)
  {
    let startKey: Record<string, unknown> | undefined;
    for (;;) {
      const { items, lastKey } = await incidentRepo.listRetentionDue(pageSize(), startKey);
      for (const inc of items) {
        if (inc.retGsiPk !== RETENTION_GSI_PK) continue;
        if (inc.legalHold === true) continue;
        const policy = inc.retentionPolicyId ?? env.defaultRetentionPolicyId;
        try {
          const okDel = await withRetry("incident.delete", () => incidentRepo.deleteIfNotOnLegalHold(inc.incidentId));
          if (!okDel) continue;
          await logDeletion({
            agencyId: inc.agencyId,
            sourceTable: env.incidentsTable,
            resourceType: "incident",
            key: { incidentId: inc.incidentId },
            policyId: policy,
            retentionPolicyId: inc.retentionPolicyId ?? policy,
          });
          incN += 1;
        } catch (e) {
          errors.push(`incident:${inc.incidentId}:${String(e)}`);
        }
      }
      if (!lastKey) break;
      startKey = lastKey;
    }
  }

  return { media: mediaN, transcript: trN, analysis: anN, incident: incN, errors };
}

/** EventBridge / Scheduler (no payload). */
export const handler: Handler = async () => {
  const out = await processRetentionPass();
  console.log(
    JSON.stringify({
      type: "retention.executor.complete",
      ...out,
    }),
  );
};
