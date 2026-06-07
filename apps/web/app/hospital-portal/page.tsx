import { redirect } from "next/navigation";
import { resolveHospitalPortalDashboardHref } from "rapid-cortex-shared/auth/rapid-cortex-roles";

import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isHospitalPortalEnabled } from "@/lib/runtime-flags";

/** Legacy `/hospital-portal` entry — routes to role-specific dashboards. */
export default async function HospitalPortalPage() {
  if (!isHospitalPortalEnabled()) {
    redirect("/unauthorized");
  }

  const user = await getDashboardSessionUser();
  if (!user) {
    redirect("/login?returnTo=/hospital-portal");
  }

  const home = resolveHospitalPortalDashboardHref(user.role);
  if (home) {
    redirect(home);
  }

  redirect("/unauthorized");
}
