import { randomUUID } from "node:crypto";
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { ZodError } from "zod";
import type { UserContext } from "rapid-cortex-shared";
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
import { ApiClientRepository, type ApiClientRecord } from "../repositories/apiClientRepository.js";
import { ExternalApiRateLimitRepository } from "../repositories/externalApiRateLimitRepository.js";
import { IncidentRepository } from "../repositories/incidentRepository.js";
import { TranscriptRepository } from "../repositories/transcriptRepository.js";
import { verifyExternalAccessToken } from "../lib/externalApiJwt.js";
import { requestIdentity, writeExternalApiAudit } from "../lib/externalApiAudit.js";
import { env } from "../lib/env.js";
import { integrationUserFromApiClient } from "../lib/syntheticIntegrationUser.js";
import { exchangeClientCredentials } from "./oauthClientCredentialsService.js";
import { AnalysisService } from "./analysisService.js";
import { redactUnknown } from "../security/redact.js";
import { IncidentService } from "./incidentService.js";
import { MediaService } from "./mediaService.js";
import { TranscriptService } from "./transcriptService.js";
import { publishAgencyWebhooks } from "./agencyWebhookPublisher.js";
import { translateFromEnglish } from "./language/languageProviderFactory.js";
import { TranslationUnavailableError } from "./language/translationControlledError.js";
import { NormalizedAiError } from "../ai/normalizedAiError.js";
import { makeId } from "../lib/ids.js";

const incidentService = new IncidentService();
const transcriptService = new TranscriptService();
const analysisService = new AnalysisService();
const mediaService = new MediaService();
const apiClients = new ApiClientRepository();
const rateRepo = new ExternalApiRateLimitRepository();
const incidentsRepo = new IncidentRepository();
const transcriptRepo = new TranscriptRepository();
const auditRepo = new AuditRepository();

function json(
  statusCode: number,
  body: Record<string, unknown>,
  requestId: string,
): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "X-Request-ID": requestId,
      "X-Rapid-Cortex-API-Version": "v1",
    },
    body: JSON.stringify({ ...body, requestId }),
  };
}

function resolveRequestId(event: APIGatewayProxyEventV2): string {
  return (
    (event.requestContext as { requestId?: string }).requestId ??
    event.headers?.["x-request-id"] ??
    event.headers?.["X-Request-Id"] ??
    randomUUID()
  );
}

function tierLimit(tier: ApiClientRecord["rateLimitTier"], bucket: string): number {
  const base = tier === "enterprise" ? 6000 : tier === "high" ? 600 : 120;
  switch (bucket) {
    case "ai":
      return Math.max(10, Math.floor(base / 6));
    case "transcript":
      return Math.max(20, Math.floor(base / 4));
    case "reports":
    case "audit":
      return Math.max(15, Math.floor(base / 5));
    default:
      return base;
  }
}

function rateBucketForPath(subPath: string): string {
  if (subPath.includes("/transcript")) return "transcript";
  if (subPath.includes("/summarize") || subPath.includes("/translate")) return "ai";
  if (subPath.includes("/media-link")) return "media";
  if (subPath.includes("/cad-export")) return "cad";
  if (subPath.includes("/reports/usage")) return "reports";
  if (subPath.includes("/audit-logs")) return "audit";
  return "default";
}

async function enforceRate(params: {
  agencyId: string;
  clientId: string;
  tier: ApiClientRecord["rateLimitTier"];
  bucket: string;
}) {
  const minute = Math.floor(Date.now() / 60_000);
  const limit = tierLimit(params.tier, params.bucket);
  const pk = `${params.agencyId}#${params.clientId}#${params.bucket}#${minute}`;
  await rateRepo.incrementOrThrow({
    pk,
    limit,
    ttlSeconds: 120,
  });
}

function parseJsonBody(raw: string | undefined): unknown {
  try {
    return JSON.parse(raw ?? "{}");
  } catch {
    return {};
  }
}

function assertScopes(have: Set<string>, need: string): void {
  if (!have.has(need)) throw new Error("INSUFFICIENT_SCOPE");
}

function assertIp(row: ApiClientRecord, meta: ReturnType<typeof requestIdentity>): void {
  if (!row.allowedIps?.length) return;
  const ip = meta.ip ?? "";
  if (!ip || !row.allowedIps.includes(ip)) {
    throw new Error("IP_BLOCKED");
  }
}

async function resolveAuthBearer(
  event: APIGatewayProxyEventV2,
): Promise<{
  client: ApiClientRecord;
  scopes: Set<string>;
  user: UserContext;
}> {
  const hdr =
    event.headers?.authorization ?? event.headers?.Authorization ?? event.headers?.["Authorization"];
  const m = hdr?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!m) throw new Error("UNAUTHORIZED");

  const claims = await verifyExternalAccessToken(m.trim());
  const row = await apiClients.get(claims.sub);
  if (!row) throw new Error("UNAUTHORIZED");
  if (row.status !== "active") throw new Error("CLIENT_DISABLED");
  if (row.agencyId !== claims.cid) throw new Error("FORBIDDEN");
  assertIp(row, requestIdentity(event));
  const scopes = new Set(row.scopes);
  const user = integrationUserFromApiClient({ agencyId: row.agencyId, clientId: row.clientId });
  return { client: row, scopes, user };
}

async function logAccess(params: {
  agencyId: string;
  clientId: string;
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
    agencyId: params.agencyId,
    actorType: "api_client",
    clientId: params.clientId,
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

async function oauthTokenExchange(
  event: APIGatewayProxyEventV2,
  requestId: string,
): Promise<APIGatewayProxyStructuredResultV2> {
  if (!env.apiClientsTable) {
    return json(503, { error: "Agency API is not configured", code: "api_not_configured" }, requestId);
  }
  let body: Record<string, unknown>;
  try {
    const ct = event.headers?.["content-type"] ?? event.headers?.["Content-Type"] ?? "";
    const raw = event.body ?? "";
    const decoded =
      event.isBase64Encoded && typeof raw === "string" ? Buffer.from(raw, "base64").toString("utf8") : raw;
    if (ct.includes("application/x-www-form-urlencoded")) {
      const p = new URLSearchParams(decoded);
      body = {};
      for (const [k, v] of p.entries()) body[k] = v;
    } else {
      body = parsedObject(parseJsonBody(decoded));
    }
  } catch {
    body = {};
  }
  body.grant_type = body.grant_type ?? "client_credentials";

  try {
    oauthClientCredentialsTokenSchema.parse(body);
    const tokens = await exchangeClientCredentials(body);
    return json(200, { ...tokens, token_type: "Bearer" }, requestId);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "invalid_request";
    if (msg === "INVALID_CLIENT") {
      return json(401, { error: "Invalid client credentials", code: "invalid_client" }, requestId);
    }
    if ((e as Error & { issues?: unknown }).issues || (e as { name?: string }).name === "ZodError") {
      return json(400, { error: "Invalid token request body", code: "invalid_request" }, requestId);
    }
    return json(401, { error: "Unauthorized", code: "oauth_error", detail: msg }, requestId);
  }
}

function parsedObject(o: unknown): Record<string, unknown> {
  return o && typeof o === "object" && !Array.isArray(o)
    ? (o as Record<string, unknown>)
    : {};
}

export async function dispatchExternalApiV1(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyStructuredResultV2> {
  const requestId = resolveRequestId(event);
  const rawPathFull = event.rawPath.split("?")[0] ?? "";
  const prefix = "/api/v1";
  let path = rawPathFull.startsWith(prefix) ? rawPathFull.slice(prefix.length) : rawPathFull;
  path = path || "/";
  if (!path.startsWith("/")) path = `/${path}`;
  path = path.replace(/\/{2,}/g, "/");

  const method = (event.requestContext as { http?: { method?: string } }).http?.method ?? "GET";
  const pathWithQueryForAudit = `${method} ${path}`;

  /** --- OAuth token (public) --- */
  if (method === "POST" && path === "/oauth/token") {
    const res = await oauthTokenExchange(event, requestId);
    return res;
  }

  if (!env.apiClientsTable || !env.externalApiRateLimitsTable) {
    return json(
      503,
      { error: "Agency API persistence is not configured (tables)", code: "api_not_configured" },
      requestId,
    );
  }

  let auth!: Awaited<ReturnType<typeof resolveAuthBearer>>;
  try {
    auth = await resolveAuthBearer(event);
  } catch (e: unknown) {
    const code = e instanceof Error ? e.message : "UNAUTHORIZED";
    const mapped =
      code === "CLIENT_DISABLED"
        ? 403
        : code === "IP_BLOCKED" || code === "FORBIDDEN"
          ? 403
          : 401;
    return json(mapped, { error: "Unauthorized", code: code.toLowerCase() }, requestId);
  }

  const bucket = rateBucketForPath(path);
  try {
    await enforceRate({
      agencyId: auth.client.agencyId,
      clientId: auth.client.clientId,
      tier: auth.client.rateLimitTier,
      bucket,
    });
  } catch (e: unknown) {
    if ((e as Error & { code?: string }).code === "RATE_LIMITED") {
      return json(
        429,
        { error: "Rate limit exceeded", code: "rate_limited", retry_after_seconds: 60 },
        requestId,
      );
    }
    throw e;
  }

  /** Route handler */
  const run = async (): Promise<{ statusCode: number; payload: Record<string, unknown>; action: string }> => {
    if (method === "POST" && path === "/incidents") {
      assertScopes(auth!.scopes, "incidents:write");
      const parsed = externalCreateIncidentBodySchema.parse(parseJsonBody(event.body ?? undefined));
      const incident = await incidentService.create(parsed.title, parsed.source, auth!.user, {
        callerAddressLine: parsed.callerAddressLine ?? undefined,
      });
      void publishAgencyWebhooks(auth!.client.agencyId, "incident.created", {
        incidentId: incident.incidentId,
        agencyId: incident.agencyId,
      }).catch(() => {});
      return { statusCode: 201, payload: { incident }, action: "incident.create" };
    }

    const incMatchGet = /^\/incidents\/([^/]+)$/.exec(path);
    if (method === "GET" && incMatchGet) {
      assertScopes(auth!.scopes, "incidents:read");
      const incidentId = incMatchGet[1];
      const inc = await incidentsRepo.get(incidentId);
      if (!inc || inc.agencyId !== auth!.client.agencyId) throw new Error("NOT_FOUND");
      return { statusCode: 200, payload: { incident: inc }, action: "incident.get" };
    }

    const incMatchPatch = /^\/incidents\/([^/]+)$/.exec(path);
    if (method === "PATCH" && incMatchPatch) {
      assertScopes(auth!.scopes, "incidents:write");
      const incidentId = incMatchPatch[1];
      const inc = await incidentsRepo.get(incidentId);
      if (!inc || inc.agencyId !== auth!.client.agencyId) throw new Error("NOT_FOUND");
      const body = externalPatchIncidentBodySchema.parse(parseJsonBody(event.body ?? "{}"));
      const normalized =
        body.callerAddressLine != null ? normalizeAddressForIndex(body.callerAddressLine) : undefined;
      await incidentsRepo.patchIntegrationFields(incidentId, {
        ...body,
        callerAddressNormalized:
          body.callerAddressLine === undefined ? undefined : normalized?.length ? normalized : null,
      });
      const next = await incidentsRepo.get(incidentId);
      void publishAgencyWebhooks(auth!.client.agencyId, "incident.updated", {
        incidentId,
      }).catch(() => {});
      return { statusCode: 200, payload: { incident: next }, action: "incident.patch" };
    }

    const trMatch = /^\/incidents\/([^/]+)\/transcript$/.exec(path);
    if (method === "POST" && trMatch) {
      assertScopes(auth!.scopes, "transcript:write");
      const incidentId = trMatch[1];
      const seg = transcriptSegmentSchema.parse(parseJsonBody(event.body ?? "{}"));
      const segment = await transcriptService.add(incidentId, seg, auth!.user);
      void publishAgencyWebhooks(auth!.client.agencyId, "transcript.received", {
        incidentId,
        segmentId: segment.segmentId,
      }).catch(() => {});
      return { statusCode: 201, payload: { segment }, action: "transcript.add" };
    }

    const sumMatch = /^\/incidents\/([^/]+)\/summarize$/.exec(path);
    if (method === "POST" && sumMatch) {
      assertScopes(auth!.scopes, "ai:summary");
      const incidentId = sumMatch[1];
      try {
        const analysis = await analysisService.analyze(incidentId, auth!.user, {
          triggerType: "manual",
          requestId,
        });
        void publishAgencyWebhooks(auth!.client.agencyId, "ai_summary.ready", {
          incidentId,
          analysisId: analysis.analysisId,
        }).catch(() => {});
        return { statusCode: 201, payload: { analysis }, action: "ai.summarize" };
      } catch (e: unknown) {
        if (e instanceof NormalizedAiError) {
          return {
            statusCode: e.httpStatus,
            payload: { error: e.publicMessage, code: e.code },
            action: "ai.summarize_failed",
          };
        }
        throw e;
      }
    }

    const xlatMatch = /^\/incidents\/([^/]+)\/translate$/.exec(path);
    if (method === "POST" && xlatMatch) {
      assertScopes(auth!.scopes, "translation:write");
      const incidentId = xlatMatch[1];
      const incident = await incidentsRepo.get(incidentId);
      if (!incident || incident.agencyId !== auth!.client.agencyId) throw new Error("NOT_FOUND");
      const b = externalTranslateBodySchema.parse(parseJsonBody(event.body ?? "{}"));
      const segs = await transcriptRepo.listByIncident(incidentId);
      const english = segs.map((s) => s.text).join("\n").trim();
      if (!english) throw new Error("EMPTY_TRANSLATION_SOURCE");
      const out = await translateFromEnglish(english, b.targetLanguage, {
        requestId,
        agencyId: auth!.client.agencyId,
        incidentId,
      });
      void publishAgencyWebhooks(auth!.client.agencyId, "translation.complete", { incidentId }).catch(() => {});
      return {
        statusCode: 200,
        payload: { translation: out },
        action: "translation.run",
      };
    }

    const mediaMatch = /^\/incidents\/([^/]+)\/media-link$/.exec(path);
    if (method === "POST" && mediaMatch) {
      assertScopes(auth!.scopes, "media:write");
      const incidentId = mediaMatch[1];
      const bodyIn = requestIncidentMediaBodySchema.parse(parseJsonBody(event.body ?? "{}"));
      try {
        const result = await mediaService.requestMedia(incidentId, auth!.user, bodyIn);
        void publishAgencyWebhooks(auth!.client.agencyId, "media.uploaded", {
          incidentId,
          mediaId: result.media.mediaId,
        }).catch(() => {});
        return { statusCode: 201, payload: result, action: "media.request" };
      } catch (e: unknown) {
        const m = e instanceof Error ? e.message : "";
        if (m === "INCIDENT_MEDIA_DISABLED" || m.includes("INCIDENT_MEDIA")) {
          throw new Error("MEDIA_UNAVAILABLE");
        }
        throw e;
      }
    }

    const cadMatch = /^\/incidents\/([^/]+)\/cad-export$/.exec(path);
    if (method === "POST" && cadMatch) {
      assertScopes(auth!.scopes, "cad:export");
      const incidentId = cadMatch[1];
      const incident = await incidentsRepo.get(incidentId);
      if (!incident || incident.agencyId !== auth!.client.agencyId) throw new Error("NOT_FOUND");
      externalCadExportBodySchema.parse(parseJsonBody(event.body ?? "{}"));
      const exportId = makeId("cad");
      void publishAgencyWebhooks(auth!.client.agencyId, "cad_export.ready", { incidentId, exportId }).catch(
        () => {},
      );
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
      assertScopes(auth!.scopes, "reports:read");
      const until = new Date();
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const rows = await auditRepo.listByAgencyBetween(
        auth!.client.agencyId,
        since.toISOString(),
        until.toISOString(),
        2000,
      );
      const filtered = rows.filter(
        (r) => String(r.details?.actorType ?? "") === "api_client" && String(r.details?.clientId ?? "") !== "",
      );
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
      assertScopes(auth!.scopes, "audit:read");
      const items = await auditRepo.listByAgency(auth!.client.agencyId, 75);
      return { statusCode: 200, payload: { items }, action: "audit.list" };
    }

    throw new Error("NOT_FOUND");
  };

  try {
    const result = await run();
    await logAccess({
      agencyId: auth.client.agencyId,
      clientId: auth.client.clientId,
      endpoint: pathWithQueryForAudit,
      method,
      action: result.action,
      resourceType: "http",
      requestId,
      statusCode: result.statusCode,
      success: true,
      event,
    });
    return json(result.statusCode, result.payload, requestId);
  } catch (e: unknown) {
    if (e instanceof ZodError) {
      await logAccess({
        agencyId: auth.client.agencyId,
        clientId: auth.client.clientId,
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
      return json(
        400,
        { error: "Invalid request payload", code: "validation_error" },
        requestId,
      );
    }
    const msg = e instanceof Error ? e.message : "error";
    if (msg === "INSUFFICIENT_SCOPE") {
      await logAccess({
        agencyId: auth.client.agencyId,
        clientId: auth.client.clientId,
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
      return json(403, { error: "Insufficient scope", code: "insufficient_scope" }, requestId);
    }
    if (msg === "NOT_FOUND") {
      await logAccess({
        agencyId: auth.client.agencyId,
        clientId: auth.client.clientId,
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
      return json(404, { error: "Not found", code: "not_found" }, requestId);
    }
    if (msg === "MEDIA_UNAVAILABLE") {
      await logAccess({
        agencyId: auth.client.agencyId,
        clientId: auth.client.clientId,
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
      return json(503, { error: "Incident media is disabled for this deployment", code: "media_unavailable" }, requestId);
    }
    if (e instanceof TranslationUnavailableError) {
      await logAccess({
        agencyId: auth.client.agencyId,
        clientId: auth.client.clientId,
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
      return json(422, e.payload, requestId);
    }
    if (msg === "EMPTY_TRANSLATION_SOURCE") {
      await logAccess({
        agencyId: auth.client.agencyId,
        clientId: auth.client.clientId,
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
      return json(400, { error: "No transcript content to translate", code: "empty_translation_source" }, requestId);
    }
    console.error(JSON.stringify(redactUnknown({ type: "external.v1.dispatcher_error", message: msg })));
    await logAccess({
      agencyId: auth.client.agencyId,
      clientId: auth.client.clientId,
      endpoint: pathWithQueryForAudit,
      method,
      action: "error",
      resourceType: "http",
      requestId,
      statusCode: 500,
      success: false,
      errorCode: "server_error",
      event,
    });
    return json(500, { error: "Request failed", code: "server_error" }, requestId);
  }
}
