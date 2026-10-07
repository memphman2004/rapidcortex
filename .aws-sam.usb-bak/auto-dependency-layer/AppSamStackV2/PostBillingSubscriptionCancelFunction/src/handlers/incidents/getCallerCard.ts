import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { canAccessCallerCard } from "../../lib/callerCardRbac.js";
import { forbidden, notFound, ok, serverError, unauthorized } from "../../lib/response.js";
import { makeId } from "../../lib/ids.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import { CallerCardService } from "../../services/callerCardService.js";

const service = new CallerCardService();
const auditRepo = new AuditRepository();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const incidentId = event.pathParameters?.id;
    if (!incidentId) return notFound("Incident ID required");

    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
    if (!canAccessCallerCard(user)) return forbidden();

    const card = await service.get(incidentId, user);
    if (card === null) return forbidden("Caller card unavailable or access denied");

    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: card.agencyId,
      incidentId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.CALLER_CARD_VIEWED,
      details: { incidentId },
      createdAt: new Date().toISOString(),
      resourceType: "incident",
      resourceId: incidentId,
    });

    return ok(card);
  } catch {
    return serverError();
  }
};
