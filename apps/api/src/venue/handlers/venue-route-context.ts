import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { AuthorizationService } from "rapid-cortex-security";
import type { UserContext } from "rapid-cortex-shared";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { operationalPasswordBlock } from "../../lib/operationalPasswordGate.js";
import { badRequest, forbidden, unauthorized } from "../../lib/response.js";
import { canAccessVenueTenant, normalizeVenueCode } from "../venue-access.js";

const authz = new AuthorizationService();

type VenueRouteContext =
  | { response: APIGatewayProxyResultV2 }
  | { user: UserContext; venueCode: string; agencyId: string };

export async function requireVenueRouteContext(
  event: APIGatewayProxyEventV2,
  permission: string,
  venueCodeParam?: string,
): Promise<VenueRouteContext> {
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

  const venueCode = venueCodeParam?.trim() || event.pathParameters?.venueCode?.trim();
  if (!venueCode) {
    return { response: withCorrelationHeaders(event, badRequest("venueCode is required")) };
  }

  if (!canAccessVenueTenant(user, venueCode)) {
    return { response: withCorrelationHeaders(event, forbidden("Venue code mismatch")) };
  }

  const agencyId = user.agencyId ?? "";
  if (!agencyId) {
    return { response: withCorrelationHeaders(event, forbidden()) };
  }

  return {
    user,
    venueCode: normalizeVenueCode(venueCode),
    agencyId,
  };
}
