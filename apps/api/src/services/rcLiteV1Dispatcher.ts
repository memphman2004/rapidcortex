import { randomUUID } from "node:crypto";
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { ZodError } from "zod";
import type { RcLiteProgrammaticApiKey, RcLiteProgrammaticScope } from "rapid-cortex-shared";
import {
  externalCadExportBodySchema,
  externalCreateIncidentBodySchema,
  externalPatchIncidentBodySchema,
  externalTranslateBodySchema,
  normalizeAddressForIndex,
  oauthClientCredentialsTokenSchema,
  requestIncidentMediaBodySchema,
  transcriptSegmentSchema,
} from "rapid-cortex-shared";
import { AuditRepository } from "../repositories/auditRepository.js";
import { IncidentRepository } from "../repositories/incidentRepository.js";
import { TranscriptRepository } from "../repositories/transcriptRepository.js";
import { RcLiteUsageRepository } from "../repositories/rcLiteUsageRepository.js";
import { RcLiteRateLimitRepository } from "../repositories/rcLiteRateLimitRepository.js";
import { requestIdentity, writeExternalApiAudit } from "../lib/externalApiAudit.js";
import { env } from "../lib/env.js";
import { integrationUserFromRcLiteKey } from "../lib/syntheticIntegrationUser.js";
import { AnalysisService } from "./analysisService.js";
import { IncidentService } from "./incidentService.js";
import { MediaService } from "./mediaService.js";
import { TranscriptService } from "./transcriptService.js";
import { publishAgencyWebhooks } from "./agencyWebhookPublisher.js";
import { translateFromEnglish } from "./language/languageProviderFactory.js";
import { TranslationUnavailableError } from "./language/translationControlledError.js";
import { NormalizedAiError } from "../ai/normalizedAiError.js";
import { makeId } from "../lib/ids.js";
import { RcLiteApiKeyService } from "./rcLiteApiKeyService.js";
import { redactUnknown } from "../security/redact.js";

const incidentService = new IncidentService();
const transcriptService = new TranscriptService();
const analysisService = new AnalysisService();
const mediaService = new MediaService();
const incidentsRepo = new IncidentRepository();
const transcriptRepo = new TranscriptRepository();
const auditRepo = new AuditRepository();
const usageRepo = new RcLiteUsageRepository();
const rateRepo = new RcLiteRateLimitRepository();
const keyService = new RcLiteApiKeyService();

const DOCS_ERRORS = "https://api.rapidcortex.us/docs#errors";

function resolveRequestId(event: APIGatewayProxyEventV2): string {
  return (
    (event.requestContext as { requestId?: string }).requestId ??
    event.headers?.["x-request-id"] ??
    event.headers?.["X-Request-Id"] ??
    randomUUID()
  );
}

function nextMinuteBoundaryUnix(): number {
  return Math.ceil(Date.now() / 60_000) * 60;
}

function utcYearMonth(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function usageKeyFor(keyId: string, ym: string): string {
  return `${keyId}#${ym}`;
}

function extractRcLiteRawKey(event: APIGatewayProxyEventV2): string | null {
  const H = event.headers ?? {};
  const apiKey =
    H["x-api-key"] ??
    H["X-Api-Key"] ??
    H["X-API-KEY"] ??
    H["x-api-key".toUpperCase()];
  if (apiKey?.trim().startsWith("rclite_")) return apiKey.trim();
  const auth = H["authorization"] ?? H["Authorization"];
  const trimmed = typeof auth === "string" ? auth.trim() : "";
  const m = /^Bearer\s+(rclite_(?:live|test)_[a-f0-9]{32})\s*$/i.exec(trimmed);
  return m?.[1]?.trim() ?? null;
}

function scopesSet(key: RcLiteProgrammaticApiKey): Set<string> {
  return new Set(key.scopes as string[]);
}

function assertScope(have: Set<string>, need: RcLiteProgrammaticScope): void {
  if (!have.has(need)) throw new Error("INSUFFICIENT_SCOPE");
}

function json(
  statusCode: number,
  body: Record<string, unknown>,
  requestId: string,
  key: RcLiteProgrammaticApiKey | null,
  rate: { limit: number; remaining: number; reset: number },
  quotaRemaining?: number,
  extraHeaders?: Record<string, string>,
): APIGatewayProxyStructuredResultV2 {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Request-Id": requestId,
    "X-RateLimit-Limit": String(rate.limit),
    "X-RateLimit-Remaining": String(Math.max(0, rate.remaining)),
    "X-RateLimit-Reset": String(rate.reset),
    "X-RC-Version": "v1",
    ...extraHeaders,
  };
  if (key?.agencyId) headers["X-RC-Agency"] = key.agencyId;
  if (quotaRemaining !== undefined) headers["X-RateLimit-Quota-Remaining"] = String(Math.max(0, quotaRemaining));

  const errBody =
    statusCode >= 400
      ? {
          error: typeof body.error === "string" ? body.error : "unknown_error",
          message: typeof body.message === "string" ? body.message : "Request failed",
          requestId,
          docs: DOCS_ERRORS,
          ...body,
        }
      : { ...body, requestId };

  return {
    statusCode,
    headers,
    body: JSON.stringify(errBody),
  };
}

function parseJsonBody(raw: string | undefined): unknown {
  try {
    return JSON.parse(raw ?? "{}");
  } catch {
    return {};
  }
}

function parsedObject(o: unknown): Record<string, unknown> {
  return o && typeof o === "object" && !Array.isArray(o) ? (o as Record<string, unknown>) : {};
}

function rateBucketForPath(subPath: string): string {
  if (subPath.includes("/transcript")) return "transcript";
  if (subPath.includes("/summarize") || subPath.includes("/translate")) return "ai";
  if (subPath.includes("/media-link")) return "media";
  if (subPath.includes("/cad-export")) return "cad";
  if (subPath.includes("/usage") || subPath.includes("/reports/usage")) return "reports";
  if (subPath.includes("/audit-logs")) return "audit";
  return "default";
}

/** Align with OAuth external tier buckets (per-minute budget split). */
function perBucketLimit(key: RcLiteProgrammaticApiKey, bucket: string): number {
  const base = key.rateLimitPerMinute;
  switch (bucket) {
    case "ai":
      return Math.max(10, Math.floor(base / 6));
    case "transcript":
      return Math.max(20, Math.floor(base / 4));
    case "reports":
    case "audit":
      return Math.max(15, Math.floor(base / 5));
    default:
      return Math.max(1, base);
  }
}

function isProductionRcLite(stage: string): boolean {
  return stage === "prod" || stage === "pilot";
}

async function logAccess(params: {
  key: RcLiteProgrammaticApiKey;
  endpoint: string;
  method: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  requestId: string;
  statusCode: number;
  success: boolean;
  errorCode?: string;
  event: APIGatewayProxyEventV2;
}) {
  const meta = requestIdentity(params.event);
  await writeExternalApiAudit({
    agencyId: params.key.agencyId,
    actorType: "rc_lite_api_key",
    clientId: params.key.keyId,
    endpoint: params.endpoint,
    method: params.method,
    action: params.action,
    resourceType: params.resourceType,
    resourceId: params.resourceId,
    requestId: params.requestId,
    statusCode: params.statusCode,
    success: params.success,
    errorCode: params.errorCode,
    sourceIp: meta.ip,
    userAgent: meta.userAgent,
  });
}

function shouldCountUsage(statusCode: number): boolean {
  return statusCode !== 401 && statusCode !== 429;
}

async function bumpUsageQuiet(key: RcLiteProgrammaticApiKey): Promise<void> {
  try {
    const ym = utcYearMonth();
    await usageRepo.incrementSuccessCall({
      usageKey: usageKeyFor(key.keyId, ym),
      keyId: key.keyId,
      agencyId: key.agencyId,
      customerId: key.customerId,
      yearMonth: ym,
      monthlyCallLimit: key.monthlyCallLimit,
      tier: key.tier,
    });
  } catch (e: unknown) {
    console.warn(JSON.stringify(redactUnknown({ type: "rc_lite.usage_increment_failed", err: String(e) })));
  }
}

export async function dispatchRcLiteV1(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyStructuredResultV2> {
  const requestId = resolveRequestId(event);
  const noopRate = { limit: 0, remaining: 0, reset: nextMinuteBoundaryUnix() };

  if (!env.rcLiteEnabled) {
    return json(
      503,
      {
        error: "rc_lite_unavailable",
        message: "RC Lite API key access is disabled for this deployment.",
      },
      requestId,
      null,
      noopRate,
    );
  }
  if (!env.rcLiteApiKeysTable || !env.rcLiteRateLimitTable || !env.rcLiteUsageTable) {
    return json(
      503,
      { error: "rc_lite_not_configured", message: "RC Lite persistence is not configured." },
      requestId,
      null,
      noopRate,
    );
  }

  const rawPathFull = event.rawPath.split("?")[0] ?? "";
  const prefix = "/v1";
  let path = rawPathFull.startsWith(prefix) ? rawPathFull.slice(prefix.length) : rawPathFull;
  path = path || "/";
  if (!path.startsWith("/")) path = `/${path}`;
  path = path.replace(/\/{2,}/g, "/");

  const method =
    ((event.requestContext as { http?: { method?: string } }).http?.method ?? "GET").toUpperCase();
  const pathWithQueryForAudit = `${method} ${path}`;
  let rawSecret = extractRcLiteRawKey(event);

  /** Health-ish path without leaking deployment details when unauthenticated — still 401 (no anonymous surface). */
  if (!rawSecret) {
    return json(
      401,
      {
        error: "unauthorized",
        message: "Missing or invalid API key. Send x-api-key or Authorization: Bearer rclite_<env>_<secret>.",
      },
      requestId,
      null,
      noopRate,
    );
  }

  let key: RcLiteProgrammaticApiKey | null = null;
  try {
    key = await keyService.lookupByHash(rawSecret);
    rawSecret = null;
  } catch {
    rawSecret = null;
  }

  if (!key) {
    return json(
      401,
      { error: "unauthorized", message: "Unknown or revoked API key." },
      requestId,
      null,
      noopRate,
    );
  }

  if (isProductionRcLite(env.deploymentStage) && key.env === "test") {
    return json(
      403,
      {
        error: "forbidden",
        message: "Sandbox (test) keys cannot call production endpoints.",
      },
      requestId,
      key,
      noopRate,
    );
  }

  keyService.touchLastUsed(key.keyId);

  const ym = utcYearMonth();
  const uk = usageKeyFor(key.keyId, ym);
  let usageSnapshot = await usageRepo.get(uk);
  const used = usageSnapshot?.totalCalls ?? 0;
  const limit = key.monthlyCallLimit;
  const quotaRemaining = Number.isFinite(limit) ? Math.max(0, limit - used) : Number.MAX_SAFE_INTEGER;

  if (key.suspendOnOverage === true && used >= limit && limit < Number.MAX_SAFE_INTEGER) {
    return json(
      429,
      {
        error: "quota_exceeded",
        message: "Monthly quota reached and this credential is suspended for overages.",
      },
      requestId,
      key,
      { limit: key.rateLimitPerMinute, remaining: key.rateLimitPerMinute, reset: nextMinuteBoundaryUnix() },
      0,
    );
  }

  const bucket = rateBucketForPath(path);
  const minuteEpoch = Math.floor(Date.now() / 60_000);
  const bucketKey = `${key.keyId}#${minuteEpoch}`;
  const perMin = perBucketLimit(key, bucket);
  let remainingAfter = perMin;

  try {
    const ttlUnix = Math.floor(Date.now() / 1000) + 180;
    const ct = await rateRepo.incrementOrThrow({
      bucketKey,
      limit: perMin,
      ttlUnix,
    });
    remainingAfter = Math.max(0, perMin - ct);
  } catch (e: unknown) {
    if ((e as Error & { code?: string }).code === "RATE_LIMITED") {
      return json(
        429,
        {
          error: "rate_limit_exceeded",
          message: "Too many requests this minute.",
          retryAfterSeconds: 60,
          limit: perMin,
          reset: nextMinuteBoundaryUnix(),
        },
        requestId,
        key,
        {
          limit: perMin,
          remaining: 0,
          reset: nextMinuteBoundaryUnix(),
        },
        quotaRemaining > 1000 ? undefined : quotaRemaining,
        { "Retry-After": "60" },
      );
    }
    throw e;
  }

  const rateState = {
    limit: perMin,
    remaining: remainingAfter,
    reset: nextMinuteBoundaryUnix(),
  };

  const authScopes = scopesSet(key);
  const authUser = integrationUserFromRcLiteKey({
    agencyId: key.agencyId,
    keyId: key.keyId,
  });

  const run = async (): Promise<{ statusCode: number; payload: Record<string, unknown>; action: string }> => {
    if (method === "GET" && path === "/usage") {
      assertScope(authScopes, "usage:read");
      const row =
        usageSnapshot ??
        (await usageRepo.get(usageKeyFor(key!.keyId, utcYearMonth()))) ??
        ({
          usageKey: uk,
          keyId: key!.keyId,
          agencyId: key!.agencyId,
          customerId: key!.customerId,
          yearMonth: ym,
          totalCalls: 0,
          overageCalls: 0,
          monthlyCallLimit: key!.monthlyCallLimit,
          tier: key!.tier,
          lastUpdatedAt: "",
        } as const);
      return {
        statusCode: 200,
        action: "usage.summary",
        payload: {
          keyId: row.keyId,
          yearMonth: row.yearMonth,
          totalCalls: row.totalCalls,
          monthlyCallLimit: row.monthlyCallLimit,
          overageCalls: row.overageCalls,
          quotaRemaining:
            Number.isFinite(row.monthlyCallLimit) && row.monthlyCallLimit < Number.MAX_SAFE_INTEGER
              ? Math.max(0, row.monthlyCallLimit - row.totalCalls)
              : null,
          lastUpdatedAt: row.lastUpdatedAt || null,
        },
      };
    }

    const listRx = /^\/incidents$/;
    if (method === "GET" && listRx.test(path)) {
      assertScope(authScopes, "incidents:read");
      const rawQs = event.rawQueryString ?? "";
      const qp = new URLSearchParams(rawQs);
      const max = Math.min(Number.parseInt(qp.get("limit") ?? "50", 10) || 50, 100);
      const incidents = await incidentsRepo.listByAgencyWithLimit(key!.agencyId, max);
      return { statusCode: 200, payload: { data: incidents, total: incidents.length }, action: "incident.list" };
    }

    if (method === "POST" && path === "/incidents") {
      assertScope(authScopes, "incidents:write");
      const parsed = externalCreateIncidentBodySchema.parse(parseJsonBody(event.body ?? undefined));
      const incident = await incidentService.create(parsed.title, parsed.source, authUser, {
        callerAddressLine: parsed.callerAddressLine ?? undefined,
      });
      void publishAgencyWebhooks(key!.agencyId, "incident.created", {
        incidentId: incident.incidentId,
        agencyId: incident.agencyId,
      }).catch(() => {});
      return { statusCode: 201, payload: { incident }, action: "incident.create" };
    }

    const incMatchGet = /^\/incidents\/([^/]+)$/.exec(path);
    if (method === "GET" && incMatchGet) {
      assertScope(authScopes, "incidents:read");
      const incidentId = incMatchGet[1];
      const inc = await incidentsRepo.get(incidentId);
      if (!inc || inc.agencyId !== key!.agencyId) throw new Error("NOT_FOUND");
      return { statusCode: 200, payload: { incident: inc }, action: "incident.get" };
    }

    const incMatchPatch = /^\/incidents\/([^/]+)$/.exec(path);
    if (method === "PATCH" && incMatchPatch) {
      assertScope(authScopes, "incidents:write");
      const incidentId = incMatchPatch[1];
      const inc = await incidentsRepo.get(incidentId);
      if (!inc || inc.agencyId !== key!.agencyId) throw new Error("NOT_FOUND");
      const body = externalPatchIncidentBodySchema.parse(parseJsonBody(event.body ?? "{}"));
      const normalized =
        body.callerAddressLine != null ? normalizeAddressForIndex(body.callerAddressLine) : undefined;
      await incidentsRepo.patchIntegrationFields(incidentId, {
        ...body,
        callerAddressNormalized:
          body.callerAddressLine === undefined ? undefined : normalized?.length ? normalized : null,
      });
      const next = await incidentsRepo.get(incidentId);
      void publishAgencyWebhooks(key!.agencyId, "incident.updated", { incidentId }).catch(() => {});
      return { statusCode: 200, payload: { incident: next }, action: "incident.patch" };
    }

    const trMatch = /^\/incidents\/([^/]+)\/transcript$/.exec(path);
    if (method === "POST" && trMatch) {
      assertScope(authScopes, "transcripts:write");
      const incidentId = trMatch[1];
      const seg = transcriptSegmentSchema.parse(parseJsonBody(event.body ?? "{}"));
      const segment = await transcriptService.add(incidentId, seg, authUser);
      void publishAgencyWebhooks(key!.agencyId, "transcript.received", {
        incidentId,
        segmentId: segment.segmentId,
      }).catch(() => {});
      return { statusCode: 201, payload: { segment }, action: "transcript.add" };
    }

    const sumMatch = /^\/incidents\/([^/]+)\/summarize$/.exec(path);
    if (method === "POST" && sumMatch) {
      assertScope(authScopes, "ai:read");
      const incidentId = sumMatch[1];
      try {
        const analysis = await analysisService.analyze(incidentId, authUser, {
          triggerType: "manual",
          requestId,
        });
        void publishAgencyWebhooks(key!.agencyId, "ai_summary.ready", {
          incidentId,
          analysisId: analysis.analysisId,
        }).catch(() => {});
        return { statusCode: 201, payload: { analysis }, action: "ai.summarize" };
      } catch (e: unknown) {
        if (e instanceof NormalizedAiError) {
          return {
            statusCode: e.httpStatus,
            payload: { error: e.publicMessage, code: e.code, message: e.publicMessage },
            action: "ai.summarize_failed",
          };
        }
        throw e;
      }
    }

    const xlatMatch = /^\/incidents\/([^/]+)\/translate$/.exec(path);
    if (method === "POST" && xlatMatch) {
      assertScope(authScopes, "translation:write");
      const incidentId = xlatMatch[1];
      const incident = await incidentsRepo.get(incidentId);
      if (!incident || incident.agencyId !== key!.agencyId) throw new Error("NOT_FOUND");
      const b = externalTranslateBodySchema.parse(parseJsonBody(event.body ?? "{}"));
      const segs = await transcriptRepo.listByIncident(incidentId);
      const english = segs.map((s) => s.text).join("\n").trim();
      if (!english) throw new Error("EMPTY_TRANSLATION_SOURCE");
      const out = await translateFromEnglish(english, b.targetLanguage, {
        requestId,
        agencyId: key!.agencyId,
        incidentId,
      });
      void publishAgencyWebhooks(key!.agencyId, "translation.complete", { incidentId }).catch(() => {});
      return { statusCode: 200, payload: { translation: out }, action: "translation.run" };
    }

    const mediaMatch = /^\/incidents\/([^/]+)\/media-link$/.exec(path);
    if (method === "POST" && mediaMatch) {
      assertScope(authScopes, "media:write");
      const incidentId = mediaMatch[1];
      const bodyIn = requestIncidentMediaBodySchema.parse(parseJsonBody(event.body ?? "{}"));
      try {
        const result = await mediaService.requestMedia(incidentId, authUser, bodyIn);
        void publishAgencyWebhooks(key!.agencyId, "media.uploaded", {
          incidentId,
          mediaId: result.media.mediaId,
        }).catch(() => {});
        return { statusCode: 201, payload: result, action: "media.request" };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "INCIDENT_MEDIA_DISABLED" || msg.includes("INCIDENT_MEDIA")) {
          throw new Error("MEDIA_UNAVAILABLE");
        }
        throw e;
      }
    }

    const cadMatch = /^\/incidents\/([^/]+)\/cad-export$/.exec(path);
    if (method === "POST" && cadMatch) {
      assertScope(authScopes, "cad:read");
      const incidentId = cadMatch[1];
      const incident = await incidentsRepo.get(incidentId);
      if (!incident || incident.agencyId !== key!.agencyId) throw new Error("NOT_FOUND");
      externalCadExportBodySchema.parse(parseJsonBody(event.body ?? "{}"));
      const exportId = makeId("cad");
      void publishAgencyWebhooks(key!.agencyId, "cad_export.ready", { incidentId, exportId }).catch(() => {});
      return {
        statusCode: 202,
        payload: {
          exportId,
          status: "queued",
          incidentId,
          message: "CAD export queued for assembly (integration preview).",
        },
        action: "cad.export",
      };
    }

    if (method === "GET" && path === "/reports/usage") {
      assertScope(authScopes, "usage:read");
      const until = new Date();
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const rows = await auditRepo.listByAgencyBetween(key!.agencyId, since.toISOString(), until.toISOString(), 2000);
      const filtered = rows.filter((r) => String(r.details?.actorType ?? "") === "rc_lite_api_key");
      return {
        statusCode: 200,
        payload: {
          requestsLast24h: filtered.length,
          window: { since: since.toISOString(), until: until.toISOString() },
          sampleEvents: filtered.slice(0, 25).map((r) => ({
            eventId: r.eventId,
            createdAt: r.createdAt,
            endpoint: r.details.endpoint,
          })),
        },
        action: "reports.usage",
      };
    }

    if (method === "GET" && path === "/audit-logs") {
      assertScope(authScopes, "audit:read");
      const items = await auditRepo.listByAgency(key!.agencyId, 75);
      return { statusCode: 200, payload: { items }, action: "audit.list" };
    }

    /** Block OAuth token issuance on RC Lite hostname surface (parity with JWT lane). */
    if (method === "POST" && path === "/oauth/token") {
      try {
        oauthClientCredentialsTokenSchema.parse(parsedObject(parseJsonBody(event.body ?? "{}")));
      } catch {
        return {
          statusCode: 400,
          payload: { error: "Use /api/v1/oauth/token with client credentials.", code: "unsupported_grant" },
          action: "oauth.rejected",
        };
      }
      return {
        statusCode: 400,
        payload: { error: "Use /api/v1/oauth/token with client credentials.", code: "unsupported_grant" },
        action: "oauth.rejected",
      };
    }

    throw new Error("NOT_FOUND");
  };

  try {
    const result = await run();
    await logAccess({
      key,
      endpoint: pathWithQueryForAudit,
      method,
      action: result.action,
      resourceType: "http",
      requestId,
      statusCode: result.statusCode,
      success: result.statusCode < 400,
      event,
    });

    const qRem =
      typeof limit === "number" && limit < Number.MAX_SAFE_INTEGER ? Math.max(0, limit - used) : undefined;
    const res = json(
      result.statusCode,
      result.payload,
      requestId,
      key,
      rateState,
      qRem,
    );
    if (shouldCountUsage(result.statusCode)) void bumpUsageQuiet(key);
    return res;
  } catch (e: unknown) {
    if (e instanceof ZodError) {
      await logAccess({
        key,
        endpoint: pathWithQueryForAudit,
        method,
        action: "validation_failed",
        resourceType: "http",
        requestId,
        statusCode: 400,
        success: false,
        errorCode: "validation_error",
        event,
      });
      const qRem =
        typeof limit === "number" && limit < Number.MAX_SAFE_INTEGER ? Math.max(0, limit - used) : undefined;
      return json(
        400,
        {
          error: "validation_error",
          message: "Invalid request payload",
          fields: e.flatten(),
        },
        requestId,
        key,
        rateState,
        qRem,
      );
    }
    const msg = e instanceof Error ? e.message : "error";
    if (msg === "INSUFFICIENT_SCOPE") {
      await logAccess({
        key,
        endpoint: pathWithQueryForAudit,
        method,
        action: "denied",
        resourceType: "http",
        requestId,
        statusCode: 403,
        success: false,
        errorCode: "insufficient_scope",
        event,
      });
      const qRem =
        typeof limit === "number" && limit < Number.MAX_SAFE_INTEGER ? Math.max(0, limit - used) : undefined;
      return json(
        403,
        {
          error: "insufficient_scope",
          message: "Credential is missing a required scope for this operation.",
        },
        requestId,
        key,
        rateState,
        qRem,
      );
    }
    if (msg === "NOT_FOUND") {
      await logAccess({
        key,
        endpoint: pathWithQueryForAudit,
        method,
        action: "not_found",
        resourceType: "http",
        requestId,
        statusCode: 404,
        success: false,
        errorCode: "not_found",
        event,
      });
      const qRem =
        typeof limit === "number" && limit < Number.MAX_SAFE_INTEGER ? Math.max(0, limit - used) : undefined;
      return json(404, { error: "not_found", message: "Resource not found." }, requestId, key, rateState, qRem);
    }
    if (msg === "MEDIA_UNAVAILABLE") {
      await logAccess({
        key,
        endpoint: pathWithQueryForAudit,
        method,
        action: "media.disabled",
        resourceType: "http",
        requestId,
        statusCode: 503,
        success: false,
        errorCode: "media_unavailable",
        event,
      });
      const qRem =
        typeof limit === "number" && limit < Number.MAX_SAFE_INTEGER ? Math.max(0, limit - used) : undefined;
      return json(
        503,
        { error: "media_unavailable", message: "Incident media is disabled for this deployment." },
        requestId,
        key,
        rateState,
        qRem,
      );
    }
    if (e instanceof TranslationUnavailableError) {
      await logAccess({
        key,
        endpoint: pathWithQueryForAudit,
        method,
        action: "translation.unavailable",
        resourceType: "incident",
        requestId,
        statusCode: 422,
        success: false,
        errorCode: "translation_unavailable",
        event,
      });
      const qRem =
        typeof limit === "number" && limit < Number.MAX_SAFE_INTEGER ? Math.max(0, limit - used) : undefined;
      return json(422, { ...e.payload, error: "translation_unavailable" }, requestId, key, rateState, qRem);
    }
    if (msg === "EMPTY_TRANSLATION_SOURCE") {
      await logAccess({
        key,
        endpoint: pathWithQueryForAudit,
        method,
        action: "translation.empty_source",
        resourceType: "incident",
        requestId,
        statusCode: 400,
        success: false,
        errorCode: "empty_translation_source",
        event,
      });
      const qRem =
        typeof limit === "number" && limit < Number.MAX_SAFE_INTEGER ? Math.max(0, limit - used) : undefined;
      return json(
        400,
        { error: "empty_translation_source", message: "No transcript content to translate." },
        requestId,
        key,
        rateState,
        qRem,
      );
    }
    console.error(JSON.stringify(redactUnknown({ type: "rc_lite.v1.dispatcher_error", message: msg })));
    await logAccess({
      key,
      endpoint: pathWithQueryForAudit,
      method,
      action: "error",
      resourceType: "http",
      requestId,
      statusCode: 500,
      success: false,
      errorCode: "internal_error",
      event,
    });
    const qRem =
      typeof limit === "number" && limit < Number.MAX_SAFE_INTEGER ? Math.max(0, limit - used) : undefined;
    return json(
      500,
      { error: "internal_error", message: "Request failed." },
      requestId,
      key,
      rateState,
      qRem,
    );
  }
}