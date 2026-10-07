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
    const overrideId = event.pathParameters?.overrideId;
    if (!overrideId) return notFound("Missing override id");
    const row = await service.getById(
      user,
      overrideId,
      event.queryStringParameters?.agencyId ?? null,
    );
    if (!row) return notFound("Override not found");
    return ok(row);
  } catch (error) {
    return normalizeAccessOverridesError(error);
  }
};
