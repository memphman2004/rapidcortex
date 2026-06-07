import { redirect } from "next/navigation";
import { resolveHospitalPortalDashboardHref } from "rapid-cortex-shared/auth/rapid-cortex-roles";

import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isHospitalPortalEnabled } from "@/lib/runtime-flags";

/** Legacy `/app/hospital` alias — same routing as `/hospital-portal`. */
export default async function AppHospitalEntryPage() {
  if (!isHospitalPortalEnabled()) {
    redirect("/unauthorized");
  }

  const user = await getDashboardSessionUser();
  if (!user) {
    redirect("/login?returnTo=/app/hospital");
  }

  const home = resolveHospitalPortalDashboardHref(user.role);
  if (home) {
    redirect(home);
  }

  redirect("/unauthorized");
}
