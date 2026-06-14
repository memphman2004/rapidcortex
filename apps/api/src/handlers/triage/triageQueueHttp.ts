import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { triageQueuePatchBodySchema } from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES, AuthorizationService, isSupervisorOrAdmin } from "rapid-cortex-security";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
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
import { env } from "../../lib/env.js";
import { getActiveQueue, getQueueItemByIncident, patchQueueItem } from "../../lib/triage/queue-store.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import { makeId } from "../../lib/ids.js";

const authz = new AuthorizationService();
const auditRepo = new AuditRepository();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    if (!env.enableNonEmergencyTriage) {
      return serviceUnavailable("Non-emergency triage is not enabled for this deployment");
    }
    if (!env.nonEmergencyQueueTable) {
      return serviceUnavailable("Non-emergency queue is not configured for this deployment");
    }

    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);

    const method = event.requestContext.http.method.toUpperCase();

    if (method === "GET") {
      if (!isSupervisorOrAdmin(user.role)) return forbidden();
      const items = await getActiveQueue(user.agencyId);
      return ok({ items, count: items.length });
    }

    if (method === "PATCH") {
      const incidentId = event.pathParameters?.incidentId;
      if (!incidentId) return badRequest("incidentId required");

      const parsed = triageQueuePatchBodySchema.safeParse(JSON.parse(event.body ?? "{}"));
      if (!parsed.success) return badRequestFromZod(parsed.error);

      const item = await getQueueItemByIncident(user.agencyId, incidentId);
      if (!item) return notFound("Queue item not found");

      if (!isSupervisorOrAdmin(user.role)) {
        const body = parsed.data;
        const isClaiming = body.status === "IN_PROGRESS" && item.status === "PENDING";
        const isReleasingOwn = body.status === "PENDING" && item.assignedTo === user.userId;
        const isClosingOwn = body.status === "CLOSED" && item.assignedTo === user.userId;
        if (!authz.canDispatch(user) || (!isClaiming && !isReleasingOwn && !isClosingOwn)) {
          return forbidden();
        }
      }

      const patch: Parameters<typeof patchQueueItem>[2] = {};
      if (parsed.data.status) patch.status = parsed.data.status;

      if (parsed.data.status === "IN_PROGRESS") {
        patch.assignedTo = parsed.data.assignedTo ?? user.userId;
      }
      if (parsed.data.status === "CLOSED") {
        patch.closedAt = new Date().toISOString();
        patch.closedBy = user.userId;
        patch.closureNotes = parsed.data.closureNotes;
      }
      if (parsed.data.status === "PENDING") {
        patch.assignedTo = null;
      }

      await patchQueueItem(user.agencyId, item.sk, patch);

      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: user.agencyId,
        incidentId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.TRIAGE_QUEUE_UPDATED,
        details: { newStatus: parsed.data.status ?? null },
        createdAt: new Date().toISOString(),
        resourceType: "incident",
        resourceId: incidentId,
      });

      return ok({ ok: true });
    }

    return badRequest("Method not allowed");
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") return forbidden();
    return serverError();
  }
};
