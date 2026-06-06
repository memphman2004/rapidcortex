import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { authFailure, forbidden, jsonStatus } from "../../lib/response.js";
import {
  handleAgencyEmergencyOverrideRequestRoute,
  handleAgencyNetworkPolicyAdminRoute,
  handleAgencyNetworkPolicyCheckRoute,
} from "../../routes/admin/agency-network-policy.js";

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  if (event.requestContext.http.method === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,PATCH,POST,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "authorization,content-type",
      },
    };
  }

  const path = event.rawPath ?? "";
  const skipNetwork =
    path === "/api/agency/network-policy-check" || path === "/api/agency/emergency-override-request";
  const user = await getUserContext(event, { skipNetworkAccess: skipNetwork });
  if (!user) return authFailure(event);
  if (!isUserAccountActive(user)) return authFailure(event, ACCOUNT_INACTIVE_MESSAGE);

  if (path === "/api/agency/network-policy-check") {
    return handleAgencyNetworkPolicyCheckRoute(event, user);
  }
  if (path === "/api/agency/emergency-override-request" && event.requestContext.http.method === "POST") {
    return handleAgencyEmergencyOverrideRequestRoute(event, user);
  }
  if (path.includes("/api/admin/agencies/") && path.includes("/network-policy")) {
    return handleAgencyNetworkPolicyAdminRoute(event, user);
  }
  return forbidden();
};
