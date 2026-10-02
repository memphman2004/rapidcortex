import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { AuthorizationService } from "rapid-cortex-security";
import type { UserContext } from "rapid-cortex-shared";
import { isRcInternalOperator } from "rapid-cortex-shared";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { operationalPasswordBlock } from "../../lib/operationalPasswordGate.js";
import { badRequest, forbidden, unauthorized } from "../../lib/response.js";
import { canAccessCampusTenant, normalizeCampusCode } from "../../campus/campus-access.js";

const authz = new AuthorizationService();

type CampusRouteContext =
  | { response: APIGatewayProxyResultV2 }
  | { user: UserContext; campusCode: string; agencyId: string };

function canManageCampusOnboarding(user: UserContext): boolean {
  if (isRcInternalOperator(user.role)) return true;
  if (user.role.trim().toLowerCase() === "agencyit") return true;
  try {
    authz.assertCanPerform(user, "campus.settings.manage" as never);
    return true;
  } catch {
    return false;
  }
}

function canViewCampusOnboarding(user: UserContext): boolean {
  if (canManageCampusOnboarding(user)) return true;
  try {
    authz.assertCanPerform(user, "campus.settings.view" as never);
    return true;
  } catch {
    return false;
  }
}

export async function requireCampusRouteContext(
  event: APIGatewayProxyEventV2,
  permission: "view" | "manage",
  campusCodeParam?: string,
): Promise<CampusRouteContext> {
  const user = await getUserContext(event);
  if (!user) return { response: withCorrelationHeaders(event, unauthorized()) };
  if (!isUserAccountActive(user)) {
    return { response: withCorrelationHeaders(event, unauthorized(ACCOUNT_INACTIVE_MESSAGE)) };
  }
  const pwd = operationalPasswordBlock(user);
  if (pwd) return { response: withCorrelationHeaders(event, pwd) };

  const allowed = permission === "manage" ? canManageCampusOnboarding(user) : canViewCampusOnboarding(user);
  if (!allowed) {
    return { response: withCorrelationHeaders(event, forbidden()) };
  }

  const campusCode =
    campusCodeParam?.trim() ||
    event.pathParameters?.campusCode?.trim() ||
    event.queryStringParameters?.campusCode?.trim();
  if (!campusCode) {
    return { response: withCorrelationHeaders(event, badRequest("campusCode is required")) };
  }

  if (!canAccessCampusTenant(user, campusCode)) {
    return { response: withCorrelationHeaders(event, forbidden("Campus code mismatch")) };
  }

  const queryAgencyId = event.queryStringParameters?.agencyId?.trim();
  const isCrossTenantOperator =
    isRcInternalOperator(user.role) || user.role.trim().toLowerCase() === "agencyit";
  const agencyId = isCrossTenantOperator ? queryAgencyId || user.agencyId || "" : user.agencyId || "";
  if (!agencyId) {
    return { response: withCorrelationHeaders(event, badRequest("agencyId is required")) };
  }

  return {
    user,
    campusCode: normalizeCampusCode(campusCode),
    agencyId,
  };
}
