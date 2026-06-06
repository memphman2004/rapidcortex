import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import {
  ACCOUNT_INACTIVE_MESSAGE,
  getUserContext,
  isUserAccountActive,
} from "../../lib/auth.js";
import { unauthorized, ok } from "../../lib/response.js";
import { AccessOverrideService } from "../../services/accessOverrideService.js";
import { normalizeAccessOverridesError } from "./accessOverridesHttp.shared.js";
const service = new AccessOverrideService();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
    const body = JSON.parse(event.body ?? "{}") as unknown;
    const created = await service.grant(user, body ?? {}, event);
    return ok(created);
  } catch (error) {
    return normalizeAccessOverridesError(error);
  }
};
