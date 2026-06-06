import { createHash, randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  RC_LITE_ERROR_CODES,
  RC_LITE_ERROR_CATALOG,
  type RcLiteApiErrorBody,
  type HttpMethod,
  resolveRcLiteRoute,
  type RcLiteV1RouteDef,
  rcLiteRouteNeedsIdempotentHeader,
} from "rapid-cortex-shared";
import { recordRcLiteUsage } from "./metering-log";
import { verifyRcLiteApiRequest } from "./api-key-context";
import { checkRcLiteRateLimit } from "./rate-limit-memory";
import { buildIdempotentCompositeKey, persistIdempotentEntry, resolveIdempotentEntry } from "./idempotency-memory";

function fingerprintBody(text: string | null): string {
  const payload = text ?? "";
  return createHash("sha256").update(payload).digest("hex");
}

function docsUrlForError(codeKey: keyof typeof RC_LITE_ERROR_CODES): string {
  const mapped = RC_LITE_ERROR_CATALOG.find((row) => row.code === codeKey);
  if (mapped?.slug) {
    return `/developers/docs/errors#${mapped.slug}`;
  }
  return "/developers/docs/errors";
}

function defaultRetryable(codeKey: keyof typeof RC_LITE_ERROR_CODES): boolean {
  const mapped = RC_LITE_ERROR_CATALOG.find((row) => row.code === codeKey);
  if (mapped?.defaultRetryable !== undefined) return mapped.defaultRetryable;
  switch (codeKey) {
    case "RATE_LIMITED":
    case "INTERNAL":
      return true;
    default:
      return false;
  }
}

export function rcLiteJsonError(
  codeKey: keyof typeof RC_LITE_ERROR_CODES,
  message: string,
  requestId: string,
  status: number,
  overrides?: Partial<Pick<RcLiteApiErrorBody["error"], "retryable" | "docsUrl" | "details">>,
): NextResponse {
  const body: RcLiteApiErrorBody = {
    error: {
      code: RC_LITE_ERROR_CODES[codeKey],
      message,
      requestId,
      retryable: overrides?.retryable ?? defaultRetryable(codeKey),
      docsUrl: overrides?.docsUrl ?? docsUrlForError(codeKey),
      details: overrides?.details,
    },
  };
  const res = NextResponse.json(body, { status, headers: { "x-request-id": requestId } });
  return res;
}

export async function handleRcLiteV1Request(
  request: NextRequest,
  pathnameSegments: string[],
  method: HttpMethod,
): Promise<Response> {
  const requestId = request.headers.get("x-request-id")?.trim() || randomUUID();
  const cleanedSegments = pathnameSegments.filter(Boolean);
  const endpoint = cleanedSegments.join("/");

  const started = performance.now();
  const latency = () => Math.round(performance.now() - started);

  const route: RcLiteV1RouteDef | null = resolveRcLiteRoute(cleanedSegments, method);

  const baseMeterUnknown = async (statusCode: number, success: boolean) =>
    recordRcLiteUsage({
      tenantId: "unknown",
      apiKeyId: "unknown",
      endpoint,
      productModule: route?.productModule ?? "unknown",
      billableUnitType: "api_call",
      billableUnits: 0,
      statusCode,
      success,
      latencyMs: latency(),
      requestId,
      timestamp: new Date().toISOString(),
    });

  if (!route) {
    await baseMeterUnknown(404, false);
    return rcLiteJsonError("NOT_FOUND", "No RC Lite endpoint matches this path and method.", requestId, 404);
  }

  /**
   * Pre-auth body buffering for fingerprints + upstream workers.
   * Only runs for routes flagged with RFC-friendly idempotent POST/PUT/PATCH/DELETE verbs.
   */
  let bufferedBodyText: string | null = null;
  if (rcLiteRouteNeedsIdempotentHeader(route, method)) {
    bufferedBodyText = await request.text();
  }

  const auth = await verifyRcLiteApiRequest(request);
  if (!auth.ok) {
    await baseMeterUnknown(401, false);
    if (auth.failureReason === "missing") {
      return rcLiteJsonError("UNAUTHORIZED", auth.error, requestId, 401);
    }
    if (auth.failureReason === "revoked") {
      return rcLiteJsonError("API_KEY_REVOKED", auth.error, requestId, 401);
    }
    return rcLiteJsonError("INVALID_API_KEY", auth.error, requestId, 401);
  }

  const idempotentKeyHeader = request.headers.get("idempotency-key")?.trim() ?? "";

  /**
   * Idempotency key handling:
   *   - composite key binds tenant + method + canonical endpoint + opaque key
   *   - fingerprint hashes request body exactly as received by the gateway
   *   - mismatched payloads return `idempotency_conflict`
   */

  if (rcLiteRouteNeedsIdempotentHeader(route, method)) {
    const fp = fingerprintBody(bufferedBodyText ?? "");
    if (!idempotentKeyHeader) {
      await recordRcLiteUsage({
        tenantId: auth.tenantId,
        apiKeyId: auth.keyId,
        endpoint,
        productModule: route.productModule,
        billableUnitType: "api_call",
        billableUnits: 0,
        statusCode: 400,
        success: false,
        latencyMs: latency(),
        requestId,
        timestamp: new Date().toISOString(),
      });
      return rcLiteJsonError("IDEMPOTENCY_REQUIRED", "Idempotency-Key header is required for this route.", requestId, 400);
    }
    const composite = buildIdempotentCompositeKey(auth.tenantId, method, endpoint, idempotentKeyHeader);
    const existing = resolveIdempotentEntry(composite, fp);
    if (existing.kind === "replay") {
      await recordRcLiteUsage({
        tenantId: auth.tenantId,
        apiKeyId: auth.keyId,
        endpoint,
        productModule: route.productModule,
        billableUnitType: "api_call",
        billableUnits: 0,
        statusCode: existing.entry.statusCode,
        success: existing.entry.statusCode < 400,
        latencyMs: latency(),
        requestId,
        timestamp: new Date().toISOString(),
        idempotentReplay: true,
      });
      return NextResponse.json(existing.entry.payload, {
        status: existing.entry.statusCode,
        headers: { "x-request-id": requestId },
      });
    }
    if (existing.kind === "conflict") {
      await recordRcLiteUsage({
        tenantId: auth.tenantId,
        apiKeyId: auth.keyId,
        endpoint,
        productModule: route.productModule,
        billableUnitType: "api_call",
        billableUnits: 0,
        statusCode: 409,
        success: false,
        latencyMs: latency(),
        requestId,
        timestamp: new Date().toISOString(),
      });
      return rcLiteJsonError(
        "IDEMPOTENCY_CONFLICT",
        "The same Idempotency-Key was reused with a different request body.",
        requestId,
        409,
      );
    }
  }

  const rl = checkRcLiteRateLimit(auth.tenantId, auth.keyId);
  if (!rl.allowed) {
    await recordRcLiteUsage({
      tenantId: auth.tenantId,
      apiKeyId: auth.keyId,
      endpoint,
      productModule: route.productModule,
      billableUnitType: "api_call",
      billableUnits: 0,
      statusCode: 429,
      success: false,
      latencyMs: latency(),
      requestId,
      timestamp: new Date().toISOString(),
    });
    const res429 = rcLiteJsonError("RATE_LIMITED", "Too many requests for this tenant or key.", requestId, 429);
    res429.headers.set("retry-after", String(rl.retryAfterSec ?? 30));
    return res429;
  }

  if (!auth.scopes.has(route.scope)) {
    await recordRcLiteUsage({
      tenantId: auth.tenantId,
      apiKeyId: auth.keyId,
      endpoint,
      productModule: route.productModule,
      billableUnitType: "api_call",
      billableUnits: 0,
      statusCode: 403,
      success: false,
      latencyMs: latency(),
      requestId,
      timestamp: new Date().toISOString(),
    });
    return rcLiteJsonError("FORBIDDEN", `Missing required scope (${route.scope}).`, requestId, 403);
  }

  if (auth.environment === "sandbox" && route.productModule === "cad_export" && endpoint.startsWith("cad/")) {
    const isExportIntent = endpoint === "cad/export" || endpoint === "cad/events" || endpoint === "cad/manual-review";
    if (isExportIntent) {
      await recordRcLiteUsage({
        tenantId: auth.tenantId,
        apiKeyId: auth.keyId,
        endpoint,
        productModule: route.productModule,
        billableUnitType: "cad_export",
        billableUnits: 0,
        statusCode: 403,
        success: false,
        latencyMs: latency(),
        requestId,
        timestamp: new Date().toISOString(),
      });
      return rcLiteJsonError(
        "FORBIDDEN",
        "Production CAD export is disabled for sandbox keys. Rotate to a production key after contract approval.",
        requestId,
        403,
      );
    }
  }

  const statusCode = 501;
  const success = false;
  const billUnits = 0;

  const stubPayload: Record<string, unknown> = {
    requestId,
    tenantId: auth.tenantId,
    stub: true,
    message: "RC Lite route registered — connect upstream processing and adjust status from 501 when live.",
    path: "/api/v1/" + endpoint,
    scope: route.scope,
    module: route.productModule,
    humanReview: {
      status: "manual_review_required",
      reason: "Upstream AI/CAD routing not yet attached in this deployment.",
      confidence: 0.42,
      recommendedReviewerRole: "supervisor",
    },
    intelligencePreview: {
      model: "rc-lite-stub",
      confidence: 0.42,
      reasoningSummary: "Stub response — wire model services to populate explainability fields.",
      riskFactors: ["deployment_not_finalized"],
      missingInformation: ["live_model_version"],
      doNotAutomate: true,
    },
  };

  await recordRcLiteUsage({
    tenantId: auth.tenantId,
    apiKeyId: auth.keyId,
    endpoint,
    productModule: route.productModule,
    billableUnitType: "api_call",
    billableUnits: billUnits,
    statusCode,
    success,
    latencyMs: latency(),
    requestId,
    timestamp: new Date().toISOString(),
  });

  const res = NextResponse.json(stubPayload, { status: statusCode });
  res.headers.set("x-request-id", requestId);

  if (rcLiteRouteNeedsIdempotentHeader(route, method) && idempotentKeyHeader) {
    const fp = fingerprintBody(bufferedBodyText ?? "");
    const composite = buildIdempotentCompositeKey(auth.tenantId, method, endpoint, idempotentKeyHeader);
    persistIdempotentEntry(composite, {
      fingerprint: fp,
      statusCode,
      payload: stubPayload as Record<string, unknown>,
    });
  }

  return res;
}
