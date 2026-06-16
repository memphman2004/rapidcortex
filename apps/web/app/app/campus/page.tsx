import { redirect } from "next/navigation";
import { dashboardRouteFromRole } from "rapid-cortex-shared";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";

/** Bare `/app/campus` — send signed-in users to their role dashboard (never render a stub here). */
export default async function CampusRootPage() {
  const user = await getDashboardSessionUser();
  if (!user) {
    redirect("/login?from=/app/campus");
  }
  redirect(dashboardRouteFromRole(user.role, user.agencyId));
}
