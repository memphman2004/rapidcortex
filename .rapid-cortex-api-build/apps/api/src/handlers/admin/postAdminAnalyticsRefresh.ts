import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { forbidden, ok, serverError, unauthorized } from "../../lib/response.js";
import { AdminAnalyticsService } from "../../services/adminAnalyticsService.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import { makeId } from "../../lib/ids.js";

const service = new AdminAnalyticsService();
const auditRepo = new AuditRepository();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
    const q = event.queryStringParameters ?? {};
    const agencyId = q.agencyId ?? user.agencyId;
    const windowDays = Math.min(90, Math.max(1, Number.parseInt(q.windowDays ?? "14", 10) || 14));
    const summary = await service.refreshAndCache(user, agencyId, windowDays);
    const now = new Date().toISOString();
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: user.agencyId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.ADMIN_ANALYTICS_REFRESHED,
      details: { targetAgencyId: summary.agencyId, windowDays },
      createdAt: now,
      resourceType: "agency",
      resourceId: summary.agencyId,
    });
    return ok(summary);
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return forbidden();
    }
    return serverError();
  }
};
