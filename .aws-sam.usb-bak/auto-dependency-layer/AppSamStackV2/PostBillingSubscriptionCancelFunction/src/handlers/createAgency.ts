import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { createAgencyBodySchema } from "rapid-cortex-shared";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../lib/auth.js";
import {
  badRequest,
  conflict,
  forbidden,
  ok,
  serverError,
  unauthorized,
  badRequestFromZod,
} from "../lib/response.js";
import { AgencyService } from "../services/agencyService.js";

const service = new AgencyService();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
    const parsed = createAgencyBodySchema.safeParse(JSON.parse(event.body ?? "{}"));
    if (!parsed.success) return badRequestFromZod(parsed.error);
    const created = await service.create(user, parsed.data);
    return ok(created, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") return forbidden();
    if (error instanceof Error && error.message === "AGENCY_EXISTS") {
      return conflict("Agency already exists");
    }
    const sc = (error as Error & { statusCode?: number }).statusCode;
    if (sc === 409) return conflict("Agency already exists");
    return serverError();
  }
};
