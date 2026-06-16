import { redirect } from "next/navigation";
import { dashboardRouteFromRole } from "rapid-cortex-shared";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";

/** Bare `/app/venue` — send signed-in users to their role dashboard. */
export default async function VenueRootPage() {
  const user = await getDashboardSessionUser();
  if (!user) {
    redirect("/login?from=/app/venue");
  }
  redirect(dashboardRouteFromRole(user.role, user.agencyId));
}
