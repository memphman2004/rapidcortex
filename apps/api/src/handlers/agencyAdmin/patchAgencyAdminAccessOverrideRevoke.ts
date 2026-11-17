import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import {
  ACCOUNT_INACTIVE_MESSAGE,
  getUserContext,
  isUserAccountActive,
} from "../../lib/auth.js";
import { badRequest, notFound, ok, unauthorized } from "../../lib/response.js";
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
    let body: unknown;
    try { body = JSON.parse(event.body ?? "{}"); } catch { return badRequest("Invalid JSON body"); }
    const out = await service.revoke(user, overrideId, body, event, event.queryStringParameters?.agencyId ?? null);
    return ok(out);
  } catch (error) {
    return normalizeAccessOverridesError(error);
  }
};
