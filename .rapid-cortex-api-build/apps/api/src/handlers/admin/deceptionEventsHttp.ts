import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { AuthorizationService } from "rapid-cortex-security";
import { isRcsuperadmin } from "rapid-cortex-shared";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { forbidden, ok, unauthorized } from "../../lib/response.js";
import { DeceptionEventsRepository } from "../../repositories/deceptionEventsRepository.js";

const authz = new AuthorizationService();
const repo = new DeceptionEventsRepository();

function httpMethod(event: Parameters<APIGatewayProxyHandlerV2>[0]): string {
  return (event.requestContext as { http?: { method?: string } }).http?.method ?? "GET";
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    if (httpMethod(event) === "OPTIONS") {
      return {
        statusCode: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,OPTIONS",
          "Access-Control-Allow-Headers": "authorization,content-type",
        },
      };
    }
    if (httpMethod(event) !== "GET") return forbidden();

    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
    if (!authz.canAccessAdminRoutes(user)) return forbidden();
    if (!isRcsuperadmin(user) && user.role !== "agencyit") return forbidden();

    const q = event.queryStringParameters ?? {};
    const items = await repo.listRecent({
      riskLevel: q.riskLevel?.trim(),
      since: q.since?.trim(),
      limit: q.limit ? Number.parseInt(q.limit, 10) : 200,
    });
    return ok({ items });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "DECEPTION_EVENTS_TABLE_NOT_CONFIGURED") return forbidden("Deception events storage is not configured.");
    throw e;
  }
};
