import { isRcsuperadmin } from "rapid-cortex-shared/tenancy/principal";
import type { Incident, UserContext } from "rapid-cortex-shared/types";
import type { Permission } from "./permissions.js";
import { isRcitadminCrossTenantPermission } from "./permissions.js";

/**
 * Resource-level tenancy checks — **caller must enforce on every Lambda/HTTP handler** touching incidents/transcripts/media.
 */
export class TenantAccessGuard {
  static isSameAgency(resourceAgencyId: string, userAgencyId: string): boolean {
    return resourceAgencyId === userAgencyId;
  }

  static assertSameAgency(resourceAgencyId: string, userAgencyId: string): void {
    if (resourceAgencyId !== userAgencyId) {
      const err = new Error("TENANT_MISMATCH");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }
  }

  /**
   * Incident scope: only `rcsuperadmin` may bypass tenant; `rcitadmin` is **never** admitted on incident rows
   * (RC IT uses user-management paths only).
   */
  static assertIncidentAccess(incident: Incident | null | undefined, user: UserContext): Incident {
    if (!incident) {
      const err = new Error("NOT_FOUND");
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }
    if (isRcsuperadmin(user)) return incident;
    this.assertSameAgency(incident.agencyId, user.agencyId);
    return incident;
  }

  /**
   * General agency scope for permissioned APIs. `rcitadmin` may pass only for {@link isRcitadminCrossTenantPermission}.
   * Emit audit `rcitadmin.cross_tenant_access` at the handler when this returns without throwing.
   */
  static assertAgencyScopeForPermission(params: {
    user: UserContext;
    permission: Permission;
    resourceAgencyId: string;
  }): void {
    const { user, permission, resourceAgencyId } = params;
    if (isRcsuperadmin(user)) return;
    if (user.role === "rcitadmin" && isRcitadminCrossTenantPermission(permission)) {
      return;
    }
    this.assertSameAgency(resourceAgencyId, user.agencyId);
  }
}
