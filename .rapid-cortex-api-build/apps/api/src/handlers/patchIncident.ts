import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { patchIncidentDispatcherSchema } from "rapid-cortex-shared";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../lib/auth.js";
import { operationalPasswordBlock } from "../lib/operationalPasswordGate.js";
import {
  badRequest,
  forbidden,
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
    if (!incidentId) return badRequest("Incident ID required");

    const parsed = patchIncidentDispatcherSchema.safeParse(JSON.parse(event.body ?? "{}"));
    if (!parsed.success) return badRequestFromZod(parsed.error);

    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
    const pwd = operationalPasswordBlock(user);
    if (pwd) return pwd;

    const updated = await service.patchDispatch(incidentId, parsed.data, user);
    if (!updated) return forbidden("Incident not found or access denied");

    return ok(updated);
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return forbidden();
    }
    return serverError();
  }
};
