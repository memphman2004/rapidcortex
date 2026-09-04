import { redirect } from "next/navigation";
import { dashboardRouteFromRole } from "rapid-cortex-shared";

import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";

export default async function AppDashboardFallbackPage() {
  const user = await getDashboardSessionUser();
  if (!user) redirect("/login");
  const home = dashboardRouteFromRole(user.role, user.agencyId);
  redirect(home === "/not-authorized" ? "/login" : home);
}
