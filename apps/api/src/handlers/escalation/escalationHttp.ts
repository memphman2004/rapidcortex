/**
 * Escalation Bridge HTTP API.
 * GET/POST /api/escalations
 * PATCH /api/escalations/{escalationId}
 * GET /api/escalations/viewer/{token}  (public)
 * GET/PUT /api/rc-admin/agencies/{agencyId}/escalation-relationship
 * POST/DELETE /api/venue/push-subscription
 */

import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import {
  CreateEscalationBodySchema,
  DeletePushSubscriptionBodySchema,
  PatchEscalationBodySchema,
  PutEscalationRelationshipBodySchema,
  UpsertPushSubscriptionBodySchema,
  isRcInternalOperator,
  isRcsuperadmin,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES, AuthorizationService } from "rapid-cortex-security";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { env } from "../../lib/env.js";
import { makeId } from "../../lib/ids.js";
import {
  appendAuditEvent,
  getEscalation,
  getEscalationByViewerToken,
  getRelationship,
  listAuditEvents,
  listEscalationsBySource,
  listEscalationsByTarget,
  putEscalation,
  putRelationship,
  recordViewerAccess,
  updateEscalationStatus,
} from "../../lib/escalation/escalation-db.js";
import { triggerExternalEscalation } from "../../lib/escalation/external-escalation.js";
import { fanOutEscalationPush } from "../../lib/escalation/fan-out-push.js";
import {
  deletePushSubscription,
  putPushSubscription,
  subscriptionIdFor,
} from "../../lib/escalation/push-subscriptions-db.js";
import { AgencyRepository } from "../../repositories/agencyRepository.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import {
  badRequest,
  badRequestFromZod,
  forbidden,
  notFound,
  ok,
  serverError,
  unauthorized,
} from "../../lib/response.js";

const agencyRepo = new AgencyRepository();
const authz = new AuthorizationService();
const auditRepo = new AuditRepository();

function parseBody(event: APIGatewayProxyEventV2): unknown {
  if (!event.body) return {};
  try {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body, "base64").toString("utf8")
      : event.body;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clientIp(event: APIGatewayProxyEventV2): string {
  return (
    event.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() ||
    event.requestContext.http?.sourceIp ||
    "unknown"
  );
}

function assertCanCreateEscalation(user: Parameters<AuthorizationService["canPerform"]>[0]): void {
  if (authz.canPerform(user, "incidents.escalate")) return;
  if (authz.canPerform(user, "campus.incidents.escalate")) return;
  if (authz.canPerform(user, "venue.incidents.escalate")) return;
  authz.assertCanPerform(user, "incidents.escalate");
}

function assertCanViewEscalation(user: Parameters<AuthorizationService["canPerform"]>[0]): void {
  if (authz.canPerform(user, "incidents.view")) return;
  if (authz.canPerform(user, "campus.incidents.view")) return;
  if (authz.canPerform(user, "venue.incidents.view")) return;
  authz.assertCanPerform(user, "incidents.view");
}

function assertCanUpdateEscalation(user: Parameters<AuthorizationService["canPerform"]>[0]): void {
  if (authz.canPerform(user, "incidents.update")) return;
  if (authz.canPerform(user, "incidents.escalate")) return;
  if (authz.canPerform(user, "campus.incidents.escalate")) return;
  if (authz.canPerform(user, "venue.incidents.escalate")) return;
  authz.assertCanPerform(user, "incidents.update");
}

function assertCanSubscribePush(user: Parameters<AuthorizationService["canPerform"]>[0]): void {
  if (authz.canPerform(user, "venue.incidents.view")) return;
  if (authz.canPerform(user, "campus.incidents.view")) return;
  authz.assertCanPerform(user, "incidents.view");
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    if (!env.enableEscalation) {
      return withCorrelationHeaders(event, badRequest("Escalation bridge is not enabled"));
    }

    const method = (event.requestContext.http?.method ?? "GET").toUpperCase();
    const path = event.rawPath ?? event.requestContext.http?.path ?? "";

    const viewerMatch = path.match(/\/escalations\/viewer\/([^/]+)/);
    if (method === "GET" && viewerMatch?.[1]) {
      const record = await getEscalationByViewerToken(viewerMatch[1]);
      if (!record) return withCorrelationHeaders(event, notFound("Escalation not found"));
      await recordViewerAccess({ escalationId: record.escalationId, ip: clientIp(event) });
      const audit = await listAuditEvents(record.escalationId);
      const expired = new Date(record.viewerTokenExpiresAt).getTime() < Date.now();
      return withCorrelationHeaders(event, ok({ escalation: record, audit, tokenExpired: expired }));
    }

    const user = await getUserContext(event);
    if (!user) return withCorrelationHeaders(event, unauthorized());
    if (!isUserAccountActive(user)) {
      return withCorrelationHeaders(event, unauthorized(ACCOUNT_INACTIVE_MESSAGE));
    }

    if (/\/venue\/push-subscription\/?$/.test(path) || /\/escalations\/push-subscription\/?$/.test(path)) {
      try {
        assertCanSubscribePush(user);
      } catch {
        return withCorrelationHeaders(event, forbidden());
      }
      if (!user.agencyId) return withCorrelationHeaders(event, forbidden());

      if (method === "POST") {
        const raw = parseBody(event);
        if (raw === null) return withCorrelationHeaders(event, badRequest("Invalid JSON"));
        const parsed = UpsertPushSubscriptionBodySchema.safeParse(raw);
        if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
        const subscriptionId = subscriptionIdFor(user.agencyId, parsed.data.endpoint, user.userId);
        await putPushSubscription({
          agencyId: user.agencyId,
          subscriptionId,
          userId: user.userId,
          endpoint: parsed.data.endpoint,
          keys: parsed.data.keys,
          userAgent: parsed.data.userAgent,
        });
        return withCorrelationHeaders(event, ok({ ok: true, subscriptionId }));
      }

      if (method === "DELETE") {
        const raw = parseBody(event);
        if (raw === null) return withCorrelationHeaders(event, badRequest("Invalid JSON"));
        const parsed = DeletePushSubscriptionBodySchema.safeParse(raw);
        if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
        const subscriptionId =
          parsed.data.subscriptionId ??
          subscriptionIdFor(user.agencyId, parsed.data.endpoint, user.userId);
        await deletePushSubscription({ agencyId: user.agencyId, subscriptionId });
        return withCorrelationHeaders(event, ok({ ok: true }));
      }
    }

    const relMatch = path.match(/\/rc-admin\/agencies\/([^/]+)\/escalation-relationship/);
    if (relMatch?.[1]) {
      try {
        authz.assertCanPerform(user, "system.tenant_mgmt");
      } catch {
        if (!isRcsuperadmin(user) && !isRcInternalOperator(user.role)) {
          return withCorrelationHeaders(event, forbidden());
        }
      }
      const agencyId = decodeURIComponent(relMatch[1]);
      if (method === "GET") {
        const rel = await getRelationship(agencyId);
        return withCorrelationHeaders(event, ok({ relationship: rel }));
      }
      if (method === "PUT") {
        const body = parseBody(event);
        if (body === null) return withCorrelationHeaders(event, badRequest("Invalid JSON"));
        const parsed = PutEscalationRelationshipBodySchema.safeParse(body);
        if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
        const now = new Date().toISOString();
        await putRelationship({
          sourceAgencyId: agencyId,
          targetAgencyId: parsed.data.targetAgencyId,
          targetPsapName: parsed.data.targetPsapName,
          targetPsapPhone: parsed.data.targetPsapPhone,
          psapType: parsed.data.psapType,
          jurisdiction: parsed.data.jurisdiction ?? "",
          active: parsed.data.active,
          createdAt: now,
          createdBy: user.email ?? user.userId,
          updatedAt: now,
        });
        return withCorrelationHeaders(event, ok({ ok: true }));
      }
    }

    const idMatch = path.match(/\/escalations\/([^/]+)/);
    const escalationId = idMatch?.[1] && idMatch[1] !== "viewer" && idMatch[1] !== "push-subscription"
      ? idMatch[1]
      : undefined;

    if (method === "GET" && path.endsWith("/export") && escalationId) {
      try {
        assertCanViewEscalation(user);
      } catch {
        return withCorrelationHeaders(event, forbidden());
      }
      const record = await getEscalation(escalationId);
      if (!record) return withCorrelationHeaders(event, notFound("Escalation not found"));
      if (
        record.sourceAgencyId !== user.agencyId &&
        record.targetAgencyId !== user.agencyId &&
        !isRcInternalOperator(user.role)
      ) {
        return withCorrelationHeaders(event, forbidden());
      }
      const audit = await listAuditEvents(escalationId);
      return withCorrelationHeaders(event, ok({ escalation: record, audit }));
    }

    if (method === "PATCH" && escalationId) {
      try {
        assertCanUpdateEscalation(user);
      } catch {
        return withCorrelationHeaders(event, forbidden());
      }
      const raw = parseBody(event);
      if (raw === null) return withCorrelationHeaders(event, badRequest("Invalid JSON"));
      const parsed = PatchEscalationBodySchema.safeParse(raw);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const existing = await getEscalation(escalationId);
      if (!existing) return withCorrelationHeaders(event, notFound("Escalation not found"));
      if (
        existing.targetAgencyId !== user.agencyId &&
        existing.sourceAgencyId !== user.agencyId &&
        !isRcInternalOperator(user.role)
      ) {
        return withCorrelationHeaders(event, forbidden());
      }
      const updated = await updateEscalationStatus(
        escalationId,
        parsed.data.status,
        user.email ?? user.userId,
        parsed.data.notes,
      );
      return withCorrelationHeaders(event, ok({ escalation: updated }));
    }

    if (method === "GET" && (path.endsWith("/escalations") || path.endsWith("/escalations/"))) {
      try {
        assertCanViewEscalation(user);
      } catch {
        return withCorrelationHeaders(event, forbidden());
      }
      const direction = event.queryStringParameters?.direction ?? "incoming";
      const agencyId = user.agencyId;
      if (!agencyId && !isRcInternalOperator(user.role)) {
        return withCorrelationHeaders(event, forbidden());
      }
      const items =
        direction === "outgoing"
          ? await listEscalationsBySource(agencyId)
          : await listEscalationsByTarget(agencyId);
      return withCorrelationHeaders(event, ok({ items }));
    }

    if (method === "POST" && (path.endsWith("/escalations") || path.endsWith("/escalations/"))) {
      try {
        assertCanCreateEscalation(user);
      } catch {
        return withCorrelationHeaders(event, forbidden());
      }
      const raw = parseBody(event);
      if (raw === null) return withCorrelationHeaders(event, badRequest("Invalid JSON"));
      const parsed = CreateEscalationBodySchema.safeParse(raw);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const body = parsed.data;
      if (!user.agencyId) return withCorrelationHeaders(event, forbidden());
      const rel = await getRelationship(user.agencyId);
      if (!rel?.active) {
        return withCorrelationHeaders(event, badRequest("No active 911 escalation relationship configured"));
      }
      const source = await agencyRepo.get(user.agencyId);
      const now = new Date();
      const escalatedAt = now.toISOString();
      const viewerToken = makeId("escview").replace(/^escview_/, "");
      const record = {
        escalationId: makeId("esc"),
        sourceAgencyId: user.agencyId,
        sourceAgencyName: source?.name ?? user.agencyId,
        sourceVertical: (source?.type === "campus" ? "campus" : "venue") as "venue" | "campus",
        targetAgencyId: rel.targetAgencyId,
        targetPsapName: rel.targetPsapName,
        targetPsapPhone: rel.targetPsapPhone,
        psapType: rel.psapType,
        incidentId: body.incidentId,
        incidentType: body.incidentType,
        incidentLocation: body.incidentLocation,
        incidentDescription: body.incidentDescription,
        incidentTimeline: body.incidentTimeline,
        reporterContact: body.reporterContact,
        mediaUrls: body.mediaUrls,
        cameraFeedUrl: body.cameraFeedUrl,
        escalatedAt,
        escalatedBy: user.email ?? user.userId,
        status: "pending" as const,
        liveLocationSent: false,
        viewerToken,
        viewerTokenExpiresAt: new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString(),
        viewerAccessCount: 0,
        retentionExpiresAt: new Date(now.getTime() + 7 * 365 * 24 * 60 * 60 * 1000).toISOString(),
        legalHold: false,
      };
      await putEscalation(record);
      await appendAuditEvent({
        escalationId: record.escalationId,
        eventType: "escalation.created",
        occurredAt: escalatedAt,
        actor: user.email ?? user.userId,
        metadata: { psapType: rel.psapType, incidentId: body.incidentId },
      });
      if (env.auditTable) {
        try {
          await auditRepo.create({
            eventId: makeId("audit"),
            agencyId: user.agencyId,
            incidentId: body.incidentId,
            actorId: user.userId,
            type: AUDIT_EVENT_TYPES.ESCALATION_RAISED,
            details: {
              escalationId: record.escalationId,
              targetAgencyId: rel.targetAgencyId,
              psapType: rel.psapType,
            },
            createdAt: escalatedAt,
            resourceType: "escalation",
            resourceId: record.escalationId,
          });
        } catch (err) {
          console.error(
            JSON.stringify({
              msg: "escalation_platform_audit_failed",
              error: err instanceof Error ? err.message : String(err),
            }),
          );
        }
      }
      if (rel.psapType === "external") {
        await triggerExternalEscalation(record);
      }
      try {
        const fanout = await fanOutEscalationPush(record);
        await appendAuditEvent({
          escalationId: record.escalationId,
          eventType: "escalation.push.fanout",
          occurredAt: new Date().toISOString(),
          actor: "system",
          metadata: fanout,
        });
      } catch (err) {
        console.error(
          JSON.stringify({
            msg: "escalation_push_fanout_error",
            escalationId: record.escalationId,
            error: err instanceof Error ? err.message : String(err),
          }),
        );
      }
      return withCorrelationHeaders(event, ok({ escalation: record }, 201));
    }

    return withCorrelationHeaders(event, notFound("Not found"));
  } catch (err) {
    console.error("escalation_http_error", err);
    return withCorrelationHeaders(event, serverError());
  }
}
