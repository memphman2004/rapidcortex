import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { z } from "zod";
import type { AuditEventType } from "rapid-cortex-shared";
import { getUserContext, isUserAccountActive } from "../lib/auth.js";
import { ok, serverError, unauthorized, badRequestFromZod } from "../lib/response.js";
import { makeId } from "../lib/ids.js";
import { AuditRepository } from "../repositories/auditRepository.js";

const auditRepo = new AuditRepository();

const bodySchema = z.object({
  action: z.string().min(1).max(220),
  incidentId: z.string().min(1).max(200).optional(),
});

/**
 * Persist-only handler: records blocked CAD write-back attempts (`CAD_WRITEBACK_DISABLED`).
 * POST `/api/security/cad-writeback-blocked`
 */
export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized();

    const parsedJson = JSON.parse(event.body ?? "{}");
    const parsed = bodySchema.safeParse(parsedJson);
    if (!parsed.success) return badRequestFromZod(parsed.error);

    const { action, incidentId } = parsed.data;

    const cadWritebackBlockedAudit: AuditEventType = "cad.writeback.blocked";

    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: user.agencyId,
      incidentId,
      actorId: user.userId,
      type: cadWritebackBlockedAudit,
      details: {
        action,
        incidentId,
        blocked: true,
        reason: "CAD_WRITEBACK_DISABLED",
        timestamp: new Date().toISOString(),
      },
      createdAt: new Date().toISOString(),
      resourceType: incidentId ? "incident" : "integration",
      ...(incidentId ? { resourceId: incidentId } : {}),
    });

    return ok({ ok: true, recorded: true });
  } catch {
    return serverError();
  }
};
