import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { AuthorizationService, AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { z } from "zod";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { makeId } from "../../lib/ids.js";
import {
  badRequest,
  badRequestFromZod,
  forbidden,
  ok,
  serverError,
  unauthorized,
} from "../../lib/response.js";
import { AuditRepository } from "../../repositories/auditRepository.js";

const authz = new AuthorizationService();
const auditRepo = new AuditRepository();

const bodySchema = z.object({
  targetUserId: z.string().min(1).max(128),
  targetDisplayName: z.string().max(200).optional(),
  incidentId: z.string().max(128).optional(),
  sessionId: z.string().max(128).optional(),
});

/**
 * Records SUPERVISOR_WATCHING when a supervisor opens Silent Monitor on a dispatcher.
 */
export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
    if (!authz.canAccessSupervisorRoutes(user)) return forbidden();
    if (!authz.canPerform(user, "workspace.silent_monitor")) return forbidden();

    let raw: unknown = {};
    try {
      raw = JSON.parse(event.body ?? "{}");
    } catch {
      return badRequest("Invalid JSON body");
    }
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) return badRequestFromZod(parsed.error);

    const { targetUserId, targetDisplayName, incidentId, sessionId } = parsed.data;
    const eventId = makeId("audit");
    const createdAt = new Date().toISOString();

    await auditRepo.create({
      eventId,
      agencyId: user.agencyId,
      actorId: user.userId,
      incidentId: incidentId ?? undefined,
      type: AUDIT_EVENT_TYPES.SUPERVISOR_WATCHING,
      details: {
        targetUserId,
        targetDisplayName: targetDisplayName ?? null,
        sessionId: sessionId ?? null,
        indicator: "SUPERVISOR_WATCHING",
      },
      createdAt,
      resourceType: "user",
      resourceId: targetUserId,
    });

    return ok({ ok: true, eventId, createdAt });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return forbidden();
    console.error("postSupervisorWatching", e);
    return serverError();
  }
};
