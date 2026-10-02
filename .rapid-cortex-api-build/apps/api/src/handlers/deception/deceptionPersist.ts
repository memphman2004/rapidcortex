import { createHash, randomUUID } from "node:crypto";
import { ulid } from "ulid";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import type { DeceptionEvent } from "./deceptionEvent.js";
import { sendSecurityAlert } from "./alerting.js";
import {
  countHoneytokenEventsByIpSince,
  putDeceptionEvent,
  queryEventsBySourceIpSince,
} from "./deceptionDynamo.js";
import { logDeceptionEventSaved } from "./deceptionLogger.js";
import { detectSuspiciousUa, scoreRisk, shouldAlertForRisk, type RiskContext } from "./riskScoring.js";
import { sanitizeHeaders, sanitizePayload, sanitizeQuery } from "./sanitize.js";

const TTL_SECONDS = 90 * 24 * 60 * 60;

function sourceIpFromEvent(event: APIGatewayProxyEventV2): string {
  const fwd = event.headers?.["x-forwarded-for"] ?? event.headers?.["X-Forwarded-For"];
  if (fwd) return fwd.split(",")[0]?.trim() || "unknown";
  const src = (event.requestContext as { http?: { sourceIp?: string } }).http?.sourceIp;
  return src?.trim() || "unknown";
}

function userAgentFromEvent(event: APIGatewayProxyEventV2): string {
  return (event.headers?.["user-agent"] ?? event.headers?.["User-Agent"] ?? "").trim();
}

function httpMethod(event: APIGatewayProxyEventV2): string {
  return (event.requestContext as { http?: { method?: string } }).http?.method ?? "GET";
}

function correlationIdFromEvent(event: APIGatewayProxyEventV2): string {
  const raw = event.headers?.["x-correlation-id"] ?? event.headers?.["X-Correlation-Id"];
  const v = raw?.trim();
  return v && v.length < 200 ? v : randomUUID();
}

function fingerprint(ip: string, ua: string, minuteBucket: string): string {
  return createHash("sha256").update(`${ip}|${ua}|${minuteBucket}`).digest("hex");
}

function isoMinusMinutes(mins: number): string {
  return new Date(Date.now() - mins * 60_000).toISOString();
}

async function gatherDecoyContext(
  event: APIGatewayProxyEventV2,
  route: string,
  method: string,
): Promise<RiskContext> {
  const sourceIp = sourceIpFromEvent(event);
  const ua = userAgentFromEvent(event);
  const since10 = isoMinusMinutes(10);
  const since5 = isoMinusMinutes(5);
  const since24h = isoMinusMinutes(24 * 60);
  const prior = await queryEventsBySourceIpSince(sourceIp, since10, 80);
  const decoyOnly = prior.filter((e) => e.eventType === "DECOY_ROUTE_HIT");
  const distinctRoutes = new Set(decoyOnly.map((e) => e.route)).size;
  const authTouches = await queryEventsBySourceIpSince(sourceIp, since5, 40);
  const touchedReal = authTouches.some((e) => e.eventType === "AUTH_CONTEXT_TOUCH");
  const honeyCount = await countHoneytokenEventsByIpSince(sourceIp, since24h);
  const postSensitive =
    method === "POST" &&
    (route === "/api/internal/cad-writeback" || route === "/api/internal/ncic-gateway");
  return {
    route,
    method,
    sourceIp,
    userAgent: ua,
    eventType: "DECOY_ROUTE_HIT",
    decoyHitsLast10MinFromIp: decoyOnly.length,
    distinctDecoyRoutesLast10Min: distinctRoutes,
    suspiciousUa: detectSuspiciousUa(ua),
    honeytokenHitsLast24hFromIp: honeyCount,
    touchedRealRouteRecently: touchedReal,
    isPostInternalSensitive: postSensitive,
  };
}

export async function persistDecoyRouteHit(
  event: APIGatewayProxyEventV2,
  route: string,
  method: string,
): Promise<void> {
  const sourceIp = sourceIpFromEvent(event);
  const ua = userAgentFromEvent(event);
  const correlationId = correlationIdFromEvent(event);
  const minuteBucket = new Date(Math.floor(Date.now() / 60_000) * 60_000).toISOString();
  const ctx = await gatherDecoyContext(event, route, method);
  const riskLevel = scoreRisk(ctx);
  const row: DeceptionEvent = {
    id: ulid(),
    eventType: "DECOY_ROUTE_HIT",
    riskLevel,
    route,
    method,
    sourceIp,
    userAgent: ua.slice(0, 512),
    requestFingerprint: fingerprint(sourceIp, ua, minuteBucket),
    payloadSummary: sanitizePayload(event.body, 500),
    headersSummary: sanitizeHeaders(event.headers as Record<string, string | undefined>),
    querySummary: sanitizeQuery(event.queryStringParameters ?? undefined),
    correlationId,
    touchedRealRouteRecently: ctx.touchedRealRouteRecently,
    createdAt: new Date().toISOString(),
    ttl: Math.floor(Date.now() / 1000) + TTL_SECONDS,
  };
  await putDeceptionEvent(row);
  logDeceptionEventSaved(row);
  if (shouldAlertForRisk(riskLevel)) {
    await sendSecurityAlert(row);
  }
}

export async function persistHoneytokenUse(
  event: APIGatewayProxyEventV2,
  tokenKey: string,
): Promise<void> {
  const sourceIp = sourceIpFromEvent(event);
  const ua = userAgentFromEvent(event);
  const correlationId = correlationIdFromEvent(event);
  const minuteBucket = new Date(Math.floor(Date.now() / 60_000) * 60_000).toISOString();
  const since10 = isoMinusMinutes(10);
  const since5 = isoMinusMinutes(5);
  const since24h = isoMinusMinutes(24 * 60);
  const prior = await queryEventsBySourceIpSince(sourceIp, since10, 80);
  const decoyOnly = prior.filter((e) => e.eventType === "DECOY_ROUTE_HIT");
  const distinctRoutes = new Set(decoyOnly.map((e) => e.route)).size;
  const authTouches = await queryEventsBySourceIpSince(sourceIp, since5, 40);
  const touchedReal = authTouches.some((e) => e.eventType === "AUTH_CONTEXT_TOUCH");
  const honeyCount = (await countHoneytokenEventsByIpSince(sourceIp, since24h)) + 1;
  const ctx: RiskContext = {
    route: event.rawPath ?? "",
    method: httpMethod(event),
    sourceIp,
    userAgent: ua,
    eventType: "HONEYTOKEN_USED",
    honeytokenKey: tokenKey,
    decoyHitsLast10MinFromIp: decoyOnly.length,
    distinctDecoyRoutesLast10Min: distinctRoutes,
    suspiciousUa: detectSuspiciousUa(ua),
    honeytokenHitsLast24hFromIp: honeyCount,
    touchedRealRouteRecently: touchedReal,
    isPostInternalSensitive: false,
  };
  const riskLevel = scoreRisk(ctx);
  const row: DeceptionEvent = {
    id: ulid(),
    eventType: "HONEYTOKEN_USED",
    riskLevel,
    route: ctx.route,
    method: ctx.method,
    sourceIp,
    userAgent: ua.slice(0, 512),
    requestFingerprint: fingerprint(sourceIp, ua, minuteBucket),
    honeytokenUsed: tokenKey,
    payloadSummary: sanitizePayload(event.body, 500),
    headersSummary: sanitizeHeaders(event.headers as Record<string, string | undefined>),
    querySummary: sanitizeQuery(event.queryStringParameters ?? undefined),
    correlationId,
    touchedRealRouteRecently: ctx.touchedRealRouteRecently,
    createdAt: new Date().toISOString(),
    ttl: Math.floor(Date.now() / 1000) + TTL_SECONDS,
  };
  await putDeceptionEvent(row);
  logDeceptionEventSaved(row);
  if (shouldAlertForRisk(riskLevel)) {
    await sendSecurityAlert(row);
  }
}

export type DeceptionActor = { userId: string; agencyId: string };

export async function persistCrossContamination(
  event: APIGatewayProxyEventV2,
  user: DeceptionActor,
): Promise<void> {
  const sourceIp = sourceIpFromEvent(event);
  const ua = userAgentFromEvent(event);
  const correlationId = correlationIdFromEvent(event);
  const minuteBucket = new Date(Math.floor(Date.now() / 60_000) * 60_000).toISOString();
  const row: DeceptionEvent = {
    id: ulid(),
    eventType: "CROSS_CONTAMINATION",
    riskLevel: "CRITICAL",
    route: event.rawPath ?? "",
    method: httpMethod(event),
    sourceIp,
    userAgent: ua.slice(0, 512),
    requestFingerprint: fingerprint(sourceIp, ua, minuteBucket),
    actorUserId: user.userId,
    actorAgencyId: user.agencyId,
    payloadSummary: sanitizePayload(event.body, 500),
    headersSummary: sanitizeHeaders(event.headers as Record<string, string | undefined>),
    querySummary: sanitizeQuery(event.queryStringParameters ?? undefined),
    correlationId,
    touchedRealRouteRecently: true,
    createdAt: new Date().toISOString(),
    ttl: Math.floor(Date.now() / 1000) + TTL_SECONDS,
  };
  await putDeceptionEvent(row);
  logDeceptionEventSaved(row);
  await sendSecurityAlert(row);
}

export async function persistAuthContextTouch(event: APIGatewayProxyEventV2, user: DeceptionActor): Promise<void> {
  const path = event.rawPath ?? "";
  if (path.includes("/api/admin/security/deception-events")) return;

  const sourceIp = sourceIpFromEvent(event);
  const since5 = isoMinusMinutes(5);
  const recent = await queryEventsBySourceIpSince(sourceIp, since5, 60);
  const hadDeception = recent.some(
    (e) => e.eventType === "DECOY_ROUTE_HIT" || e.eventType === "HONEYTOKEN_USED",
  );
  if (hadDeception) {
    await persistCrossContamination(event, user);
    return;
  }
  const ua = userAgentFromEvent(event);
  const correlationId = correlationIdFromEvent(event);
  const minuteBucket = new Date(Math.floor(Date.now() / 120_000) * 120_000).toISOString();
  const id = `act_${createHash("sha256").update(`${sourceIp}|${user.userId}|${minuteBucket}`).digest("hex").slice(0, 32)}`;
  const row: DeceptionEvent = {
    id,
    eventType: "AUTH_CONTEXT_TOUCH",
    riskLevel: "LOW",
    route: event.rawPath ?? "",
    method: httpMethod(event),
    sourceIp,
    userAgent: ua.slice(0, 512),
    requestFingerprint: fingerprint(sourceIp, ua, minuteBucket),
    actorUserId: user.userId,
    actorAgencyId: user.agencyId,
    payloadSummary: "",
    headersSummary: sanitizeHeaders(event.headers as Record<string, string | undefined>),
    querySummary: sanitizeQuery(event.queryStringParameters ?? undefined),
    correlationId,
    touchedRealRouteRecently: false,
    createdAt: new Date().toISOString(),
    ttl: Math.floor(Date.now() / 1000) + TTL_SECONDS,
  };
  try {
    await putDeceptionEvent(row, { conditionExpression: "attribute_not_exists(id)" });
  } catch {
    /* duplicate id in same 2-minute window — ignore */
  }
}
