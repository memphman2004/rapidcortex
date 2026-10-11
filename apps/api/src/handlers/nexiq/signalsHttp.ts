import type { APIGatewayProxyEventV2, APIGatewayProxyHandlerV2 } from "aws-lambda";
import { randomUUID } from "node:crypto";
import {
  canAccessNexiqSignals,
  nexiqSignalCreateBodySchema,
  nexiqSignalListQuerySchema,
  nexiqSignalPatchBodySchema,
  NEXIQ_SIGNAL_MIN_CONFIDENCE,
  type NexiqSignalRecord,
  type UserContext,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import {
  ACCOUNT_INACTIVE_MESSAGE,
  getUserContext,
  isUserAccountActive,
} from "../../lib/auth.js";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { env } from "../../lib/env.js";
import { makeId } from "../../lib/ids.js";
import { operationalPasswordBlock } from "../../lib/operationalPasswordGate.js";
import { assertNexiqSignalsApiKey } from "../../lib/nexiq/signals-ingest-auth.js";
import { upsertApolloAccountFromSignal } from "../../lib/rapid-iq/apollo-accounts.js";
import {
  badRequest,
  badRequestFromZod,
  forbidden,
  notFound,
  ok,
  serverError,
  serviceUnavailable,
  unauthorized,
} from "../../lib/response.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import {
  NEXIQ_SIGNAL_SK,
  nexiqSignalPk,
  NexiqSignalsRepository,
} from "../../repositories/nexiqSignalsRepository.js";

const repo = new NexiqSignalsRepository();
const auditRepo = new AuditRepository();

let summaryCache: { at: number; body: unknown } | null = null;
const SUMMARY_TTL_MS = 60_000;

function isIamAuthorized(event: APIGatewayProxyEventV2): boolean {
  // APIGatewayEventRequestContextV2 omits authorizer; IAM/JWT payloads attach it at runtime.
  const ctx = event.requestContext as APIGatewayProxyEventV2["requestContext"] & {
    authorizer?: { iam?: { userArn?: string } | unknown; jwt?: unknown };
  };
  const auth = ctx.authorizer;
  if (auth && typeof auth === "object" && auth.iam != null) return true;
  return Boolean(
    auth &&
      typeof auth === "object" &&
      typeof (auth.iam as { userArn?: string } | undefined)?.userArn === "string",
  );
}

async function requireJwtUser(
  event: APIGatewayProxyEventV2,
): Promise<{ error: ReturnType<typeof unauthorized> } | { user: UserContext }> {
  const user = await getUserContext(event);
  if (!user) return { error: unauthorized() };
  if (!isUserAccountActive(user)) {
    return { error: unauthorized(ACCOUNT_INACTIVE_MESSAGE) };
  }
  const pwd = operationalPasswordBlock(user);
  if (pwd) return { error: pwd as ReturnType<typeof unauthorized> };
  if (!canAccessNexiqSignals(user.role)) return { error: forbidden() };
  if (!env.enableNexiqSignals) {
    return { error: serviceUnavailable("NexiQ Signals is not enabled") as never };
  }
  return { user };
}

function parsePath(event: APIGatewayProxyEventV2): { tail: string; parts: string[] } {
  const path = event.rawPath ?? event.requestContext.http?.path ?? "";
  const idx = path.indexOf("/api/signals");
  const tail = idx >= 0 ? path.slice(idx + "/api/signals".length) : "";
  const parts = tail.split("/").filter(Boolean);
  return { tail, parts };
}

async function authorizeIngest(event: APIGatewayProxyEventV2) {
  // Prefer IAM when present (SigV4 callers). Claude scheduled tasks use API key instead.
  if (isIamAuthorized(event)) return { ok: true as const };
  const keyAuth = await assertNexiqSignalsApiKey(event);
  if (keyAuth.ok) return { ok: true as const };
  if (keyAuth.reason === "ingest_not_configured" || keyAuth.reason === "secret_unavailable") {
    return {
      ok: false as const,
      response: serviceUnavailable("NexiQ Signals ingest is not configured"),
    };
  }
  return {
    ok: false as const,
    response: unauthorized("IAM or ingest API key required"),
  };
}

async function handlePost(event: APIGatewayProxyEventV2) {
  const auth = await authorizeIngest(event);
  if (!auth.ok) return auth.response;
  if (!env.enableNexiqSignals) {
    return serviceUnavailable("NexiQ Signals is not enabled");
  }

  let body: unknown;
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch {
    return badRequest("Invalid JSON body");
  }

  const parsed = nexiqSignalCreateBodySchema.safeParse(body);
  if (!parsed.success) {
    const missing = ["title", "vertical", "agencyName", "dedupeHash", "confidenceScore"].filter(
      (k) => {
        const b = body as Record<string, unknown>;
        return b[k] == null || b[k] === "";
      },
    );
    if (missing.length) {
      return badRequest(`Missing required fields: ${missing.join(", ")}`);
    }
    return badRequestFromZod(parsed.error);
  }

  const data = parsed.data;
  if (data.confidenceScore < NEXIQ_SIGNAL_MIN_CONFIDENCE) {
    return ok({ error: "below_threshold", reason: "below_threshold" }, 400);
  }

  const existing = await repo.findByDedupeHash(data.dedupeHash);
  if (existing) {
    return ok({ duplicate: true, signalId: existing.signalId });
  }

  const signalId = randomUUID();
  const createdAt = new Date().toISOString();
  const record: NexiqSignalRecord = {
    pk: nexiqSignalPk(signalId),
    sk: NEXIQ_SIGNAL_SK,
    signalId,
    title: data.title,
    summary: data.summary,
    sourceUrl: data.sourceUrl,
    vertical: data.vertical,
    agencyName: data.agencyName,
    agencyType: data.agencyType,
    geography: data.geography,
    estimatedValue: data.estimatedValue,
    dueDate: data.dueDate,
    keywords: data.keywords,
    confidenceScore: data.confidenceScore,
    confidenceTier: data.confidenceTier,
    status: "new",
    reviewedBy: null,
    reviewedAt: null,
    apolloAccountId: null,
    createdAt,
    dedupeHash: data.dedupeHash,
  };

  try {
    await repo.put(record);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("ConditionalCheckFailed")) {
      return ok({ duplicate: true });
    }
    throw err;
  }

  try {
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: "__platform__",
      actorId: "system:nexiq-signals-ingest",
      type: AUDIT_EVENT_TYPES.NEXIQ_SIGNAL_INGESTED,
      details: {
        vertical: data.vertical,
        confidenceScore: data.confidenceScore,
        signalId,
      },
      createdAt,
      resourceId: signalId,
    });
  } catch {
    /* never fail ingest on audit */
  }

  return ok({ signalId }, 201);
}

async function handleList(event: APIGatewayProxyEventV2) {
  const auth = await requireJwtUser(event);
  if ("error" in auth) return auth.error;

  const qs = event.queryStringParameters ?? {};
  const parsed = nexiqSignalListQuerySchema.safeParse(qs);
  if (!parsed.success) return badRequestFromZod(parsed.error);

  const result = await repo.list(parsed.data);
  return ok({ success: true, ...result });
}

async function handleSummary(event: APIGatewayProxyEventV2) {
  const auth = await requireJwtUser(event);
  if ("error" in auth) return auth.error;

  const now = Date.now();
  if (summaryCache && now - summaryCache.at < SUMMARY_TTL_MS) {
    return ok({ success: true, ...(summaryCache.body as object) });
  }
  const summary = await repo.summary();
  summaryCache = { at: now, body: summary };
  return ok({ success: true, ...summary });
}

async function handlePatch(event: APIGatewayProxyEventV2, signalId: string) {
  const auth = await requireJwtUser(event);
  if ("error" in auth) return auth.error;

  let body: unknown;
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch {
    return badRequest("Invalid JSON body");
  }
  const parsed = nexiqSignalPatchBodySchema.safeParse(body);
  if (!parsed.success) return badRequestFromZod(parsed.error);

  const existing = await repo.get(signalId);
  if (!existing) return notFound("Signal not found");
  if (existing.confidenceScore < NEXIQ_SIGNAL_MIN_CONFIDENCE) {
    return notFound("Signal not found");
  }

  const now = new Date().toISOString();
  const { action } = parsed.data;

  if (action === "track") {
    const updated = await repo.updateStatus(signalId, "tracking", auth.user.userId, now);
    summaryCache = null;
    try {
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: "__platform__",
        actorId: auth.user.userId,
        type: AUDIT_EVENT_TYPES.NEXIQ_SIGNAL_TRACKED,
        details: { action: "track", signalId },
        createdAt: now,
        resourceId: signalId,
      });
    } catch {
      /* ignore */
    }
    return ok({ success: true, signal: updated });
  }

  if (action === "dismiss") {
    const updated = await repo.updateStatus(signalId, "dismissed", auth.user.userId, now);
    summaryCache = null;
    try {
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: "__platform__",
        actorId: auth.user.userId,
        type: AUDIT_EVENT_TYPES.NEXIQ_SIGNAL_DISMISSED,
        details: { action: "dismiss", signalId },
        createdAt: now,
        resourceId: signalId,
      });
    } catch {
      /* ignore */
    }
    return ok({ success: true, signal: updated });
  }

  // push_to_crm — Apollo first; only then flip status
  try {
    const apollo = await upsertApolloAccountFromSignal({
      agencyName: existing.agencyName,
      vertical: existing.vertical,
      title: existing.title,
      confidenceScore: existing.confidenceScore,
      sourceUrl: existing.sourceUrl,
      state: existing.geography?.state,
    });
    const updated = await repo.updateStatus(
      signalId,
      "pushed_to_crm",
      auth.user.userId,
      now,
      apollo.apolloAccountId,
    );
    summaryCache = null;
    try {
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: "__platform__",
        actorId: auth.user.userId,
        type: AUDIT_EVENT_TYPES.NEXIQ_SIGNAL_PUSHED_TO_CRM,
        details: {
          action: "push_to_crm",
          signalId,
          apolloAccountId: apollo.apolloAccountId,
        },
        createdAt: now,
        resourceId: signalId,
      });
    } catch {
      /* ignore */
    }
    return ok({
      success: true,
      apolloAccountId: apollo.apolloAccountId,
      signal: updated,
    });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : "Apollo push failed");
  }
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const method = (event.requestContext.http?.method ?? "GET").toUpperCase();
    const { parts } = parsePath(event);

    if (method === "POST" && parts.length === 0) {
      return withCorrelationHeaders(event, await handlePost(event));
    }
    if (method === "GET" && parts[0] === "summary" && parts.length === 1) {
      return withCorrelationHeaders(event, await handleSummary(event));
    }
    if (method === "GET" && parts.length === 0) {
      return withCorrelationHeaders(event, await handleList(event));
    }
    if (method === "PATCH" && parts.length === 1 && parts[0]) {
      return withCorrelationHeaders(event, await handlePatch(event, parts[0]));
    }

    return withCorrelationHeaders(event, notFound());
  } catch (e) {
    console.error(
      JSON.stringify({
        msg: "nexiq_signals_http_error",
        error: e instanceof Error ? e.message : String(e),
      }),
    );
    return withCorrelationHeaders(event, serverError());
  }
};
