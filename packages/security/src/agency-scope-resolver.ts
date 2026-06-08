import { isRcInternalOperator, isRcsuperadmin } from "rapid-cortex-shared/tenancy/principal";
import type { UserContext } from "rapid-cortex-shared/types";
import { isCampusRole } from "./role-access-matrix-v2.js";

/**
 * Resolves which `agencyId` filters to apply for list/read operations.
 */
export class AgencyScopeResolver {
  /** Platform listing incidents must supply explicit tenant filter. */
  static requiredIncidentListAgencyId(
    user: UserContext,
    queryAgencyId: string | undefined,
  ): string {
    if (isRcsuperadmin(user)) {
      const id = queryAgencyId?.trim();
      if (!id) {
        const err = new Error("AGENCY_QUERY_REQUIRED");
        (err as Error & { statusCode?: number }).statusCode = 400;
        throw err;
      }
      return id;
    }
    return user.agencyId;
  }

  static assertCanReadAgencyProfile(user: UserContext, targetAgencyId: string): void {
    if (isRcsuperadmin(user) || isRcInternalOperator(user.role)) return;
    const role = user.role as string;
    if (user.role === "agencyadmin" && user.agencyId === targetAgencyId) return;
    if (role === "CAMPUS_ADMIN" && user.agencyId === targetAgencyId) return;
    const err = new Error("FORBIDDEN");
    (err as Error & { statusCode?: number }).statusCode = 403;
    throw err;
  }

  static assertCanManageCampusSettings(user: UserContext, targetAgencyId: string): void {
    if (isRcsuperadmin(user) || isRcInternalOperator(user.role)) return;
    const role = user.role as string;
    if (role === "CAMPUS_ADMIN" && user.agencyId === targetAgencyId) return;
    const err = new Error("FORBIDDEN");
    (err as Error & { statusCode?: number }).statusCode = 403;
    throw err;
  }

  static assertCanManageCampusStaff(user: UserContext, targetAgencyId: string): void {
    this.assertCanManageCampusSettings(user, targetAgencyId);
    const role = user.role as string;
    if (isCampusRole(role) && role !== "CAMPUS_ADMIN") {
      const err = new Error("FORBIDDEN");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }
  }
}
