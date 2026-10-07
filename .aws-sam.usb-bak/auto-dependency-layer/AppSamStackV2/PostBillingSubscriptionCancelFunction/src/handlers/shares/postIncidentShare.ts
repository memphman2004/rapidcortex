import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { postIncidentShareBodySchema } from "rapid-cortex-shared";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import {
  badRequest,
  forbidden,
  notFound,
  ok,
  serverError,
  unauthorized,
  badRequestFromZod,
} from "../../lib/response.js";
import { IncidentShareService } from "../../services/incidentShareService.js";

const service = new IncidentShareService();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const incidentId = event.pathParameters?.id;
    if (!incidentId) return badRequest("Incident ID required");

    const parsed = postIncidentShareBodySchema.safeParse(JSON.parse(event.body ?? "{}"));
    if (!parsed.success) return badRequestFromZod(parsed.error);

    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
    const row = await service.createShare(incidentId, parsed.data, user);
    return ok(row, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") return forbidden();
    if (error instanceof Error && error.message === "FEATURE_DISABLED")
      return notFound("Sharing disabled");
    if (error instanceof Error && error.message === "PARTNER_NOT_TRUSTED") {
      return badRequest("Recipient agency is not an active trusted partner");
    }
    return serverError();
  }
};
