import { redirect } from "next/navigation";
import { dashboardRouteFromRole } from "rapid-cortex-shared";

import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";

/** Prefix `/dispatcher/dashboard` is not the live PSAP workspace. */
export default async function DispatcherDashboardPage() {
  const user = await getDashboardSessionUser();
  if (!user) redirect("/login?returnTo=/dispatcher/dashboard");
  const home = dashboardRouteFromRole(user.role, user.agencyId);
  redirect(home === "/not-authorized" ? "/login" : home);
}
