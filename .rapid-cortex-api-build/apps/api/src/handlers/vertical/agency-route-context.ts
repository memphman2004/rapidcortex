import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { AuthorizationService } from "rapid-cortex-security";
import type { UserContext } from "rapid-cortex-shared";
import { isRcInternalOperator } from "rapid-cortex-shared";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { operationalPasswordBlock } from "../../lib/operationalPasswordGate.js";
import { badRequest, forbidden, unauthorized } from "../../lib/response.js";

const authz = new AuthorizationService();

export type AgencyRouteContext =
  | { response: APIGatewayProxyResultV2 }
  | { user: UserContext; agencyId: string };

export function assertAgencyMatch(user: UserContext, pathAgencyId: string): boolean {
  if (isRcInternalOperator(user.role)) return true;
  const claim = (user.agencyId ?? "").trim();
  return claim === pathAgencyId.trim();
}

export async function requireAgencyRoute(
  event: APIGatewayProxyEventV2,
  permission: string,
): Promise<AgencyRouteContext> {
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
  if (!assertAgencyMatch(user, agencyId)) {
    return { response: withCorrelationHeaders(event, forbidden("Agency mismatch")) };
  }

  return { user, agencyId };
}

export function canSupervisorCampusOps(user: UserContext): boolean {
  const role = user.role.trim().toUpperCase();
  if (isRcInternalOperator(user.role)) return true;
  if (user.role.trim().toLowerCase() === "agencyit") return true;
  return role === "CAMPUS_SUPERVISOR" || role === "CAMPUS_ADMIN";
}

export function canSupervisorVenueOps(user: UserContext): boolean {
  const role = user.role.trim().toUpperCase();
  if (isRcInternalOperator(user.role)) return true;
  if (user.role.trim().toLowerCase() === "agencyit") return true;
  return role === "VENUE_SUPERVISOR" || role === "VENUE_ADMIN";
}
