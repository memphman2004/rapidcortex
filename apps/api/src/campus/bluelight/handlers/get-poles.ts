/**
 * Campus Blue-Light Connect — GET /api/campus/bluelight/poles
 *
 * Returns registered blue-light poles for the calling user's campus.
 * Authenticated via Cognito JWT + CAMPUS_* / rcsuperadmin roles.
 * Always scoped to the user's agencyId — never cross-tenant.
 *
 * Campus vertical only.
 */

import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../../lib/auth.js";
import {
  authFailure,
  forbidden,
  notFound,
  ok,
  unauthorized,
} from "../../../lib/response.js";
import { withCorrelationHeaders } from "../../../lib/correlation.js";
import { BlueLightRegistry } from "../blue-light-registry.js";

const registry = new BlueLightRegistry();

const ALLOWED_ROLES = new Set([
  "campus_admin",
  "campus_supervisor",
  "campus_security",
  "campus_dispatch",
  "campus_counselor",
  "campus_faculty",
  // K-12 variants
  "campus_admin_k12",
  "campus_supervisor_k12",
  "campus_security_k12",
  "campus_dispatch_k12",
  // Higher-ed variants
  "campus_admin_highered",
  "campus_supervisor_highered",
  "campus_security_highered",
  "campus_dispatch_highered",
  // RC internal
  "rcsuperadmin",
  "rcadmin",
]);

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const user = await getUserContext(event);
  if (!user) return withCorrelationHeaders(event, authFailure(event));
  if (!isUserAccountActive(user))
    return withCorrelationHeaders(event, unauthorized(ACCOUNT_INACTIVE_MESSAGE));

  const roleNorm = user.role.toLowerCase().replace(/[^a-z0-9_]/g, "_");
  if (!ALLOWED_ROLES.has(roleNorm)) {
    return withCorrelationHeaders(event, forbidden("Campus roles only"));
  }

  // ── campusId from query param (must match user's agencyId for non-RC-admin) ─
  const requestedCampusId = event.queryStringParameters?.campusId?.trim();
  const userCampusId = user.agencyId?.trim();

  if (!userCampusId) {
    return withCorrelationHeaders(event, forbidden("No agency context"));
  }

  // rcsuperadmin/rcadmin may query any campus; all other roles must match their agencyId
  const isRcAdmin = roleNorm === "rcsuperadmin" || roleNorm === "rcadmin";
  const campusId = isRcAdmin && requestedCampusId ? requestedCampusId : userCampusId;

  if (!isRcAdmin && requestedCampusId && requestedCampusId !== userCampusId) {
    return withCorrelationHeaders(event, forbidden("Cross-campus access denied"));
  }

  const poles = await registry.getPolesByCampus(campusId);

  return withCorrelationHeaders(
    event,
    ok({
      poles,
      campusId,
      total: poles.length,
    }),
  );
};
