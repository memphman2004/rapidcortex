import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { AuthorizationService } from "rapid-cortex-security";
import type { UserContext } from "rapid-cortex-shared";
import { isRcInternalOperator } from "rapid-cortex-shared";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { operationalPasswordBlock } from "../../lib/operationalPasswordGate.js";
import { badRequest, forbidden, unauthorized } from "../../lib/response.js";
import { canAccessVenueTenant, normalizeVenueCode } from "../venue-access.js";

const authz = new AuthorizationService();

type VenueRouteContext =
  | { response: APIGatewayProxyResultV2 }
  | { user: UserContext; venueCode: string; agencyId: string };

function canManageVenueOnboarding(user: UserContext): boolean {
  if (isRcInternalOperator(user.role)) return true;
  if (user.role.trim().toLowerCase() === "agencyit") return true;
  try {
    authz.assertCanPerform(user, "venue.settings.manage" as never);
    return true;
  } catch {
    return false;
  }
}

function canViewVenueOnboarding(user: UserContext): boolean {
  if (canManageVenueOnboarding(user)) return true;
  try {
    authz.assertCanPerform(user, "venue.settings.view" as never);
    return true;
  } catch {
    return false;
  }
}

export async function requireVenueOnboardingRouteContext(
  event: APIGatewayProxyEventV2,
  permission: "view" | "manage",
  venueCodeParam?: string,
): Promise<VenueRouteContext> {
  const user = await getUserContext(event);
  if (!user) return { response: withCorrelationHeaders(event, unauthorized()) };
  if (!isUserAccountActive(user)) {
    return { response: withCorrelationHeaders(event, unauthorized(ACCOUNT_INACTIVE_MESSAGE)) };
  }
  const pwd = operationalPasswordBlock(user);
  if (pwd) return { response: withCorrelationHeaders(event, pwd) };

  const allowed = permission === "manage" ? canManageVenueOnboarding(user) : canViewVenueOnboarding(user);
  if (!allowed) {
    return { response: withCorrelationHeaders(event, forbidden()) };
  }

  const venueCode = venueCodeParam?.trim() || event.pathParameters?.venueCode?.trim();
  if (!venueCode) {
    return { response: withCorrelationHeaders(event, badRequest("venueCode is required")) };
  }

  if (!canAccessVenueTenant(user, venueCode)) {
    return { response: withCorrelationHeaders(event, forbidden("Venue code mismatch")) };
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
    venueCode: normalizeVenueCode(venueCode),
    agencyId,
  };
}
