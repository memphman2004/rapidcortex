import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { forbidden, notFound, ok, serverError, unauthorized } from "../../lib/response.js";
import { IncidentShareService } from "../../services/incidentShareService.js";
import { IncidentRepository } from "../../repositories/incidentRepository.js";

const service = new IncidentShareService();
const incidentRepo = new IncidentRepository();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
    const shares = await service.listIncoming(user);
    const items = [];
    for (const s of shares) {
      const incident = await incidentRepo.get(s.incidentId);
      if (incident) items.push({ share: s, incident });
    }
    return ok({ items });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") return forbidden();
    if (error instanceof Error && error.message === "FEATURE_DISABLED")
      return notFound("Sharing disabled");
    return serverError();
  }
};
