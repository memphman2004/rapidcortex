import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import {
  ACCOUNT_INACTIVE_MESSAGE,
  getUserContext,
  isUserAccountActive,
} from "../../lib/auth.js";
import { ok, unauthorized } from "../../lib/response.js";
import { AccessOverrideService } from "../../services/accessOverrideService.js";
import { normalizeAccessOverridesError } from "./accessOverridesHttp.shared.js";

const service = new AccessOverrideService();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);

    const out = await service.list(user, {
      agencyId: event.queryStringParameters?.agencyId ?? null,
      status: event.queryStringParameters?.status ?? null,
      search: event.queryStringParameters?.search ?? null,
    });
    return ok(out);
  } catch (error) {
    return normalizeAccessOverridesError(error);
  }
};
