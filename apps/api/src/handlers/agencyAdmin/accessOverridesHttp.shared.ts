import { ZodError } from "zod";
import {
  badRequest,
  badRequestFromZod,
  conflict,
  forbidden,
  notFound,
  serverError,
  serviceUnavailable,
} from "../../lib/response.js";

/** Map thrown service errors used by `/api/agency-admin/*` access override routes. */
export function normalizeAccessOverridesError(error: unknown) {
  if (error instanceof ZodError) {
    return badRequestFromZod(error);
  }
  if (!(error instanceof Error)) {
    return serverError();
  }
  switch (error.message) {
    case "FORBIDDEN":
      return forbidden();
    case "USER_NOT_FOUND":
    case "NOT_FOUND":
      return notFound(error.message === "USER_NOT_FOUND" ? "User not found" : "Override not found");
    case "INVALID_GRANT":
      return badRequest("Grant is not permitted for this administrator");
    case "SELF_GRANT_FORBIDDEN":
      return forbidden("Administrators cannot grant overrides to themselves");
    case "AGENCY_REQUIRED":
      return badRequest("agencyId query / body parameter is required for cross-tenant access");
    case "ACCESS_OVERRIDES_DISABLED":
      return serviceUnavailable("Access overrides persistence is not configured on this deployment");
    case "ALREADY_REVOKED":
      return conflict("Override already revoked");
    default:
      return serverError();
  }
}
