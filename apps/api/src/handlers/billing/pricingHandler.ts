import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { forbidden, unauthorized } from "../../lib/response.js";
import { handlePricingAdminRoute } from "../../routes/billing/pricing-admin.js";

function httpMethod(event: Parameters<APIGatewayProxyHandlerV2>[0]): string {
  return (event.requestContext as { http?: { method?: string } }).http?.method ?? "GET";
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  if (httpMethod(event) === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,PUT,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "authorization,content-type",
      },
    };
  }

  const user = await getUserContext(event);
  if (!user) return unauthorized();
  if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);

  const path = event.rawPath ?? "";
  if (!path.startsWith("/api/admin/pricing")) {
    return forbidden();
  }

  return handlePricingAdminRoute(event, user);
};
