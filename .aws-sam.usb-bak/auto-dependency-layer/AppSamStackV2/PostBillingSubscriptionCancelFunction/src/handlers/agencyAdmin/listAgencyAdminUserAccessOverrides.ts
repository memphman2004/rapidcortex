import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import {
  ACCOUNT_INACTIVE_MESSAGE,
  getUserContext,
  isUserAccountActive,
} from "../../lib/auth.js";
import { notFound, ok, unauthorized } from "../../lib/response.js";
import { AccessOverrideService } from "../../services/accessOverrideService.js";
import { normalizeAccessOverridesError } from "./accessOverridesHttp.shared.js";

const service = new AccessOverrideService();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
    const userId = event.pathParameters?.userId;
    if (!userId) return notFound("Missing user id");
    const out = await service.listForUser(
      user,
      userId,
      event.queryStringParameters?.agencyId ?? null,
    );
    return ok(out);
  } catch (error) {
    return normalizeAccessOverridesError(error);
  }
};
