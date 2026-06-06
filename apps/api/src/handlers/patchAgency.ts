import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { patchAgencyBodySchema } from "rapid-cortex-shared";
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
import { AgencyService } from "../services/agencyService.js";

const service = new AgencyService();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const agencyId = event.pathParameters?.id;
    if (!agencyId) return notFound("Agency id required");
    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
    const parsed = patchAgencyBodySchema.safeParse(JSON.parse(event.body ?? "{}"));
    if (!parsed.success) return badRequestFromZod(parsed.error);
    const updated = await service.patch(user, agencyId, parsed.data);
    return ok(updated);
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") return forbidden();
    const sc = (error as Error & { statusCode?: number }).statusCode;
    if (sc === 404) return notFound("Agency not found");
    return serverError();
  }
};
