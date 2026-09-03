import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { AuthorizationService } from "rapid-cortex-security";
import type { UserContext } from "rapid-cortex-shared";
import { isRcInternalOperator } from "rapid-cortex-shared";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { operationalPasswordBlock } from "../../lib/operationalPasswordGate.js";
import { badRequest, forbidden, unauthorized } from "../../lib/response.js";

const authz = new AuthorizationService();

export type TransitRouteContext =
  | { response: APIGatewayProxyResultV2 }
  | { user: UserContext; agencyId: string };

export function assertTransitAgencyMatch(user: UserContext, pathAgencyId: string): boolean {
  if (isRcInternalOperator(user.role)) return true;
  const claim = (user.agencyId ?? "").trim();
  return claim === pathAgencyId.trim();
}

export async function requireTransitRouteContext(
  event: APIGatewayProxyEventV2,
  permission: string,
): Promise<TransitRouteContext> {
  const user = await getUserContext(event);
  if (!user) return { response: withCorrelationHeaders(event, unauthorized()) };
  if (!isUserAccountActive(user)) {
    return { response: withCorrelationHeaders(event, unauthorized(ACCOUNT_INACTIVE_MESSAGE)) };
  }
  const pwd = operationalPasswordBlock(user);
  if (pwd) return { response: withCorrelationHeaders(event, pwd) };

  try {
    authz.assertCanPerform(user, permission as never);
  } catch {
    return { response: withCorrelationHeaders(event, forbidden()) };
  }

  const agencyId = event.pathParameters?.agencyId?.trim();
  if (!agencyId) {
    return { response: withCorrelationHeaders(event, badRequest("agencyId is required")) };
  }
  if (!assertTransitAgencyMatch(user, agencyId)) {
    return { response: withCorrelationHeaders(event, forbidden("Agency mismatch")) };
  }

  return { user, agencyId };
}
