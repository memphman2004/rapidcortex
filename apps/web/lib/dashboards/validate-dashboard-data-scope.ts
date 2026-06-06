import type { UserContext } from "rapid-cortex-shared/types";
import { isRcsuperadmin } from "rapid-cortex-shared/tenancy/principal";

/**
 * Enforce agency scoping for dashboard data APIs.
 * Non–platform users may omit `agencyId`; resolvers must still filter by `user.agencyId`.
 * If `agencyId` is present, it must match the caller's tenant.
 * TODO: Apply same checks in Lambda authorizer / API Gateway when wiring real backends.
 */
export function assertDashboardAgencyScope(
  user: UserContext,
  requestedAgencyId: string | null | undefined,
): void {
  if (isRcsuperadmin(user)) {
    return;
  }
  const requested = requestedAgencyId?.trim();
  if (requested && requested !== user.agencyId) {
    const err = new Error("Agency scope mismatch");
    (err as Error & { statusCode?: number }).statusCode = 403;
    throw err;
  }
}
