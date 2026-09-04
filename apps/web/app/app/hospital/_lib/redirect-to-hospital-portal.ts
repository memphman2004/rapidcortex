import { redirect } from "next/navigation";
import { resolveHospitalPortalDashboardHref } from "rapid-cortex-shared/auth/rapid-cortex-roles";

import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isHospitalPortalEnabled } from "@/lib/runtime-flags";

/**
 * Legacy `/app/hospital/{role}` shells are not product consoles.
 * Send operators to `/hospital-admin` or `/hospital-staff`.
 */
export async function redirectToHospitalPortal(returnTo: string): Promise<never> {
  if (!isHospitalPortalEnabled()) {
    redirect("/unauthorized");
  }

  const user = await getDashboardSessionUser();
  if (!user) {
    redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  }

  redirect(resolveHospitalPortalDashboardHref(user.role) ?? returnTo);
}
