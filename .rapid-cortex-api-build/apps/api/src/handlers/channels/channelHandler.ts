import type { APIGatewayProxyHandlerV2, APIGatewayProxyResultV2 } from "aws-lambda";
import {
  assignChannelBodySchema,
  createChannelBodySchema,
  patchChannelBodySchema,
  patchIncidentChannelBodySchema,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES, AuthorizationService, isSupervisorOrAdmin } from "rapid-cortex-security";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { env } from "../../lib/env.js";
import { makeId } from "../../lib/ids.js";
import type { ZodError } from "zod";
import { validationErrorMessageForClient } from "../../lib/zod-client-error.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import {
  assignChannelToIncident,
  createChannel,
  deactivateChannel,
  listAgencyChannels,
  listIncidentChannels,
  patchChannel,
  patchIncidentChannelNotes,
  removeIncidentChannelAssignment,
} from "../../services/channelService.js";

const authz = new AuthorizationService();
const auditRepo = new AuditRepository();

function channelLog(agencyId: string, channelId: string | undefined, message: string, extra?: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      component: "channelHandler",
      agencyId,
      channelId: channelId ?? null,
      message,
      ...extra,
    }),
  );
}

function channelError(code: string, error: string, statusCode: number): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ok: false, error, code }),
  };
}

function channelOk<T extends Record<string, unknown>>(body: T, statusCode = 200): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ok: true, ...body }),
  };
}

function channelBadRequest(err: ZodError): APIGatewayProxyResultV2 {
  return channelError("VALIDATION_ERROR", validationErrorMessageForClient(err), 400);
}

function canListChannels(user: Awaited<ReturnType<typeof getUserContext>>): boolean {
  if (!user) return false;
  return (
    authz.canPerform(user, "agency.settings.channels") ||
    authz.canPerform(user, "incidents.view") ||
    authz.canDispatch(user)
  );
}

function canManageChannels(user: NonNullable<Awaited<ReturnType<typeof getUserContext>>>): boolean {
  return authz.canPerform(user, "agency.settings.channels");
}

function canAssignChannels(user: NonNullable<Awaited<ReturnType<typeof getUserContext>>>): boolean {
  return (
    authz.canDispatch(user) ||
    isSupervisorOrAdmin(user.role) ||
    authz.canPerform(user, "agency.settings.channels")
  );
}

function channelsUnavailable(): APIGatewayProxyResultV2 {
  return channelError(
    "CHANNEL_MONITORING_DISABLED",
    "Channel monitoring is not enabled for this deployment",
    503,
  );
}

function mapServiceError(err: unknown): APIGatewayProxyResultV2 {
  const code = err instanceof Error ? err.message : "CHANNEL_ERROR";
  if (code === "CHANNEL_NOT_FOUND") return channelError(code, "Channel not found", 404);
  if (code === "INCIDENT_NOT_FOUND") return channelError(code, "Incident not found", 404);
  if (code === "ASSIGNMENT_NOT_FOUND") return channelError(code, "Channel assignment not found", 404);
  if (code === "CHANNEL_ALREADY_ASSIGNED") {
    return channelError(code, "Channel is already assigned to this incident", 409);
  }
  if (code === "CHANNEL_CONFIG_UNAVAILABLE" || code === "INCIDENT_CHANNEL_ASSIGNMENTS_UNAVAILABLE") {
    return channelError("CHANNEL_NOT_CONFIGURED", "Channel storage is not configured", 503);
  }
  console.error(err);
  return channelError("CHANNEL_INTERNAL_ERROR", "Channel operation failed", 500);
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const agencyIdForLog = "unknown";
  try {
    if (!env.enableChannelMonitoring) return channelsUnavailable();
    if (!env.channelConfigTable || !env.incidentChannelAssignmentsTable) {
      return channelError("CHANNEL_NOT_CONFIGURED", "Channel tables are not configured", 503);
    }

    const user = await getUserContext(event);
    if (!user) return channelError("UNAUTHORIZED", "Unauthorized", 401);
    if (!isUserAccountActive(user)) {
      return channelError("ACCOUNT_INACTIVE", ACCOUNT_INACTIVE_MESSAGE, 403);
    }

    const method = event.requestContext.http.method.toUpperCase();
    const path = event.rawPath ?? event.requestContext.http.path;
    const channelIdParam = event.pathParameters?.channelId;
    const incidentIdParam = event.pathParameters?.id ?? event.pathParameters?.incidentId;

    channelLog(user.agencyId, channelIdParam, `${method} ${path}`);

    if (path === "/api/channels" || path.endsWith("/api/channels")) {
      if (method === "GET") {
        if (!canListChannels(user)) return channelError("FORBIDDEN", "Forbidden", 403);
        const channels = await listAgencyChannels(user.agencyId);
        return channelOk({ channels });
      }
      if (method === "POST") {
        if (!canManageChannels(user)) return channelError("FORBIDDEN", "Forbidden", 403);
        const parsed = createChannelBodySchema.safeParse(JSON.parse(event.body ?? "{}"));
        if (!parsed.success) return channelBadRequest(parsed.error);

        const channel = await createChannel(user, parsed.data);
        channelLog(user.agencyId, channel.channelId, "channel created");

        await auditRepo.create({
          eventId: makeId("aud"),
          agencyId: user.agencyId,
          actorId: user.userId,
          type: AUDIT_EVENT_TYPES.CHANNEL_CONFIG_CREATED,
          details: { name: channel.name, discipline: channel.discipline },
          createdAt: new Date().toISOString(),
          resourceType: "channel_config",
          resourceId: channel.channelId,
        });

        return channelOk({ channel }, 201);
      }
    }

    if (channelIdParam && path.includes("/api/channels/")) {
      if (method === "PATCH") {
        if (!canManageChannels(user)) return channelError("FORBIDDEN", "Forbidden", 403);
        const parsed = patchChannelBodySchema.safeParse(JSON.parse(event.body ?? "{}"));
        if (!parsed.success) return channelBadRequest(parsed.error);

        const channel = await patchChannel(user.agencyId, channelIdParam, parsed.data);
        channelLog(user.agencyId, channel.channelId, "channel updated");

        await auditRepo.create({
          eventId: makeId("aud"),
          agencyId: user.agencyId,
          actorId: user.userId,
          type: AUDIT_EVENT_TYPES.CHANNEL_CONFIG_UPDATED,
          details: { active: channel.active },
          createdAt: new Date().toISOString(),
          resourceType: "channel_config",
          resourceId: channel.channelId,
        });

        return channelOk({ channel });
      }
      if (method === "DELETE") {
        if (!canManageChannels(user)) return channelError("FORBIDDEN", "Forbidden", 403);
        const channel = await deactivateChannel(user.agencyId, channelIdParam);
        channelLog(user.agencyId, channel.channelId, "channel deactivated");

        await auditRepo.create({
          eventId: makeId("aud"),
          agencyId: user.agencyId,
          actorId: user.userId,
          type: AUDIT_EVENT_TYPES.CHANNEL_CONFIG_DEACTIVATED,
          details: {},
          createdAt: new Date().toISOString(),
          resourceType: "channel_config",
          resourceId: channel.channelId,
        });

        return channelOk({ channel });
      }
    }

    if (incidentIdParam && path.includes("/channels")) {
      if (method === "GET" && !channelIdParam) {
        if (!canListChannels(user)) return channelError("FORBIDDEN", "Forbidden", 403);
        const assignments = await listIncidentChannels(user, incidentIdParam);
        return channelOk({ assignments });
      }

      if (method === "POST" && !channelIdParam) {
        if (!canAssignChannels(user)) return channelError("FORBIDDEN", "Forbidden", 403);
        const parsed = assignChannelBodySchema.safeParse(JSON.parse(event.body ?? "{}"));
        if (!parsed.success) return channelBadRequest(parsed.error);

        const assignment = await assignChannelToIncident(user, incidentIdParam, parsed.data);
        channelLog(user.agencyId, assignment.channelId, "channel assigned", { incidentId: incidentIdParam });

        await auditRepo.create({
          eventId: makeId("aud"),
          agencyId: user.agencyId,
          incidentId: incidentIdParam,
          actorId: user.userId,
          type: AUDIT_EVENT_TYPES.INCIDENT_CHANNEL_ASSIGNED,
          details: { channelId: assignment.channelId, channelName: assignment.channelName },
          createdAt: new Date().toISOString(),
          resourceType: "incident",
          resourceId: incidentIdParam,
        });

        return channelOk({ assignment }, 201);
      }

      if (channelIdParam && method === "PATCH") {
        if (!canAssignChannels(user)) return channelError("FORBIDDEN", "Forbidden", 403);
        const parsed = patchIncidentChannelBodySchema.safeParse(JSON.parse(event.body ?? "{}"));
        if (!parsed.success) return channelBadRequest(parsed.error);

        const assignment = await patchIncidentChannelNotes(
          user,
          incidentIdParam,
          channelIdParam,
          parsed.data.notes,
        );
        channelLog(user.agencyId, channelIdParam, "assignment notes updated", { incidentId: incidentIdParam });

        await auditRepo.create({
          eventId: makeId("aud"),
          agencyId: user.agencyId,
          incidentId: incidentIdParam,
          actorId: user.userId,
          type: AUDIT_EVENT_TYPES.INCIDENT_CHANNEL_NOTES_UPDATED,
          details: { channelId: channelIdParam },
          createdAt: new Date().toISOString(),
          resourceType: "incident",
          resourceId: incidentIdParam,
        });

        return channelOk({ assignment });
      }

      if (channelIdParam && method === "DELETE") {
        if (!canAssignChannels(user)) return channelError("FORBIDDEN", "Forbidden", 403);
        await removeIncidentChannelAssignment(user, incidentIdParam, channelIdParam);
        channelLog(user.agencyId, channelIdParam, "channel unassigned", { incidentId: incidentIdParam });

        await auditRepo.create({
          eventId: makeId("aud"),
          agencyId: user.agencyId,
          incidentId: incidentIdParam,
          actorId: user.userId,
          type: AUDIT_EVENT_TYPES.INCIDENT_CHANNEL_REMOVED,
          details: { channelId: channelIdParam },
          createdAt: new Date().toISOString(),
          resourceType: "incident",
          resourceId: incidentIdParam,
        });

        return channelOk({ removed: true });
      }
    }

    return channelError("NOT_FOUND", "Route not found", 404);
  } catch (err) {
    channelLog(agencyIdForLog, undefined, "handler error", {
      error: err instanceof Error ? err.message : String(err),
    });
    return mapServiceError(err);
  }
};
