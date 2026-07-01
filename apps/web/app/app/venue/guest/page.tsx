import { redirect } from "next/navigation";
import { dashboardRouteFromRole } from "rapid-cortex-shared";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";

/** Legacy role-segment URL — redirect to canonical code-segment guest-services home. */
export default async function VenueGuestPage() {
  const user = await getDashboardSessionUser();
  if (!user) {
    redirect("/login?from=/app/venue/guest");
  }
  redirect(dashboardRouteFromRole(user.role, user.agencyId));
}
