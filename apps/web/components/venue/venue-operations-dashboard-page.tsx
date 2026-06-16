import { redirect } from "next/navigation";
import { dashboardRouteFromRole, verticalFromRole } from "rapid-cortex-shared";
import { extractVenueCode } from "@/lib/auth/post-login-redirect";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isVerticalEnabled } from "@/lib/features";
import { resolveVenueDisplayName } from "@/lib/venue/venue-tenant";
import { VenueOperationsDashboard } from "./venue-operations-dashboard";

const VENUE_CONSOLE_ROLES = new Set([
  "VENUE_SECURITY",
  "VENUE_SUPERVISOR",
  "VENUE_OPERATOR",
]);

/** Server entry for the venue operations console — not 911 CAD or campus safety. */
export async function VenueOperationsDashboardPage() {
  if (!isVerticalEnabled("venue")) {
    redirect("/unauthorized");
  }

  const user = await getDashboardSessionUser();
  if (!user) {
    redirect("/login?from=/app/venue");
  }

  if (verticalFromRole(user.role) !== "venue") {
    redirect(dashboardRouteFromRole(user.role, user.agencyId));
  }

  const roleToken = user.role.trim().toUpperCase();
  if (!VENUE_CONSOLE_ROLES.has(roleToken)) {
    redirect(dashboardRouteFromRole(user.role, user.agencyId));
  }

  const venueCode = extractVenueCode(user.agencyId);
  const venueName = await resolveVenueDisplayName(venueCode);

  return (
    <VenueOperationsDashboard
      venueName={venueName}
      agencySlug={venueCode}
      userEmail={user.email ?? ""}
      userRole={user.role}
    />
  );
}
