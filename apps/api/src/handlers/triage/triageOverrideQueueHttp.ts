import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { triageEscalationBodySchema } from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES, AuthorizationService } from "rapid-cortex-security";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import {
  badRequest,
  badRequestFromZod,
  forbidden,
  ok,
  serverError,
  serviceUnavailable,
  unauthorized,
} from "../../lib/response.js";
import { env } from "../../lib/env.js";
import { getQueueItemByIncident, patchQueueItem } from "../../lib/triage/queue-store.js";
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
    if (!authz.canDispatch(user)) return forbidden();

    const parsed = triageEscalationBodySchema.safeParse(JSON.parse(event.body ?? "{}"));
    if (!parsed.success) return badRequestFromZod(parsed.error);

    const { incidentId, reason } = parsed.data;
    const item = await getQueueItemByIncident(user.agencyId, incidentId);

    if (!item) {
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: user.agencyId,
        incidentId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.TRIAGE_ESCALATED,
        details: { reason: reason ?? null, note: "Item not in active queue" },
        createdAt: new Date().toISOString(),
        resourceType: "incident",
        resourceId: incidentId,
      });
      return ok({ ok: true, note: "Item not in active queue." });
    }

    const now = new Date().toISOString();
    await patchQueueItem(user.agencyId, item.sk, {
      status: "ESCALATED",
      overrideBy: user.userId,
      overrideAt: now,
      overrideReason: reason,
      closedAt: now,
      closedBy: user.userId,
    });

    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: user.agencyId,
      incidentId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.TRIAGE_ESCALATED,
      details: {
        reason: reason ?? null,
        previousClassification: item.classification,
        previousConfidence: item.confidence,
      },
      createdAt: now,
      resourceType: "incident",
      resourceId: incidentId,
    });

    return ok({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") return forbidden();
    return serverError();
  }
};
