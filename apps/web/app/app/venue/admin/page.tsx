import { redirect } from "next/navigation";
import { dashboardRouteFromRole } from "rapid-cortex-shared";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";

/** Legacy role-segment URL — redirect to canonical code-segment venue home. */
export default async function VenueAdminPage() {
  const user = await getDashboardSessionUser();
  if (!user) {
    redirect("/login?from=/app/venue/admin");
  }
  redirect(dashboardRouteFromRole(user.role, user.agencyId));
}
