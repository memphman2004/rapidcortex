import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { patchIncidentLegalHoldSchema } from "rapid-cortex-shared";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../lib/auth.js";
import {
  badRequest,
  forbidden,
  notFound,
  ok,
  serverError,
  unauthorized,
  badRequestFromZod,
} from "../lib/response.js";
import { IncidentService } from "../services/incidentService.js";

const service = new IncidentService();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const incidentId = event.pathParameters?.id;
    if (!incidentId) return notFound("Incident id required");
    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
    const parsed = patchIncidentLegalHoldSchema.safeParse(JSON.parse(event.body ?? "{}"));
    if (!parsed.success) return badRequestFromZod(parsed.error);
    const out = await service.patchLegalHold(incidentId, parsed.data, user);
    if (!out) return notFound("Incident not found");
    return ok(out);
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") return forbidden();
    if (error instanceof Error && error.message.startsWith("VALIDATION:")) {
      return badRequest(error.message.replace(/^VALIDATION:/, "").trim());
    }
    return serverError();
  }
};
