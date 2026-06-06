import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import type { AdminAnalyticsSummary, UserContext } from "rapid-cortex-shared";
import { AuthorizationService } from "rapid-cortex-security";
import { isRcsuperadmin } from "rapid-cortex-shared";
import { env } from "../lib/env.js";
import { AgencyRepository } from "../repositories/agencyRepository.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import { IncidentRepository } from "../repositories/incidentRepository.js";

const s3 = new S3Client({ region: env.region });
const auditRepo = new AuditRepository();
const incidentRepo = new IncidentRepository();
const agencyRepo = new AgencyRepository();
const authz = new AuthorizationService();

function cacheKey(agencyId: string): string {
  return `${env.analyticsCachePrefix.replace(/\/$/, "")}/${agencyId}/summary.json`;
}

async function buildSummary(agencyId: string, windowDays: number): Promise<AdminAnalyticsSummary> {
  const now = Date.now();
  const since = new Date(now - windowDays * 24 * 60 * 60 * 1000).toISOString();
  const until = new Date(now).toISOString();
  const incidents = await incidentRepo.listByAgencySince(agencyId, since, 800);
  const audits = await auditRepo.listByAgencyBetween(agencyId, since, until, 5000);
  let transcriptSegmentsAppended = 0;
  let analysesCompleted = 0;
  for (const e of audits) {
    if (e.type === AUDIT_EVENT_TYPES.TRANSCRIPT_APPEND) transcriptSegmentsAppended += 1;
    if (e.type === AUDIT_EVENT_TYPES.ANALYSIS_CREATED) analysesCompleted += 1;
  }
  return {
    agencyId,
    generatedAt: new Date().toISOString(),
    windowDays,
    incidentsCreated: incidents.length,
    transcriptSegmentsAppended,
    analysesCompleted,
  };
}

export class AdminAnalyticsService {
  assertAdmin(user: UserContext): void {
    if (!authz.canAccessAdminRoutes(user)) {
      const err = new Error("FORBIDDEN");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }
  }

  resolveTargetAgencyId(user: UserContext, requested?: string | null): string {
    if (requested && isRcsuperadmin(user)) return requested;
    return user.agencyId;
  }

  async getCachedSummary(user: UserContext, agencyId: string): Promise<AdminAnalyticsSummary | null> {
    this.assertAdmin(user);
    const target = this.resolveTargetAgencyId(user, agencyId);
    if (!isRcsuperadmin(user) && target !== user.agencyId) {
      const err = new Error("FORBIDDEN");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }
    try {
      const res = await s3.send(
        new GetObjectCommand({
          Bucket: env.assetsBucket,
          Key: cacheKey(target),
        }),
      );
      const text = await res.Body?.transformToString();
      if (!text) return null;
      return JSON.parse(text) as AdminAnalyticsSummary;
    } catch {
      return null;
    }
  }

  async refreshAndCache(user: UserContext, agencyId: string, windowDays: number): Promise<AdminAnalyticsSummary> {
    this.assertAdmin(user);
    const target = this.resolveTargetAgencyId(user, agencyId);
    if (!isRcsuperadmin(user) && target !== user.agencyId) {
      const err = new Error("FORBIDDEN");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }
    const summary = await buildSummary(target, windowDays);
    await s3.send(
      new PutObjectCommand({
        Bucket: env.assetsBucket,
        Key: cacheKey(target),
        Body: JSON.stringify(summary),
        ContentType: "application/json",
      }),
    );
    return summary;
  }

  async aggregateAllAgencies(windowDays: number): Promise<void> {
    const agencies = await agencyRepo.listRecent(500);
    for (const a of agencies) {
      const summary = await buildSummary(a.agencyId, windowDays);
      await s3.send(
        new PutObjectCommand({
          Bucket: env.assetsBucket,
          Key: cacheKey(a.agencyId),
          Body: JSON.stringify(summary),
          ContentType: "application/json",
        }),
      );
    }
  }

  toCsv(summary: AdminAnalyticsSummary): string {
    const lines = [
      "metric,value",
      `agencyId,${summary.agencyId}`,
      `generatedAt,${summary.generatedAt}`,
      `windowDays,${summary.windowDays}`,
      `incidentsCreated,${summary.incidentsCreated}`,
      `transcriptSegmentsAppended,${summary.transcriptSegmentsAppended}`,
      `analysesCompleted,${summary.analysesCompleted}`,
    ];
    return lines.join("\n");
  }
}
