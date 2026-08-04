import { redirect } from "next/navigation";
import type { AgencyProfileResponse } from "rapid-cortex-shared";
import { dashboardRouteFromRole, verticalFromRole } from "rapid-cortex-shared";
import { extractVenueCode } from "@/lib/auth/post-login-redirect";
import { dashboardDisplayName } from "@/lib/dashboards/dashboard-display-name";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isVerticalEnabled } from "@/lib/features";
import { resolveVenueDisplayName } from "@/lib/venue/venue-tenant";
import { VenueConsoleHome } from "./venue-console-home";

const VENUE_CONSOLE_ROLES = new Set([
  "VENUE_SECURITY",
  "VENUE_SUPERVISOR",
  "VENUE_OPERATOR",
  "VENUE_ADMIN",
  "VENUE_GUEST_SERVICES",
]);

/** Server entry for the venue operations console — not 911 CAD or campus safety. */
export async function VenueOperationsDashboardPage({
  agencyId: agencyIdProp,
  profile,
}: {
  agencyId?: string;
  profile?: AgencyProfileResponse | null;
} = {}) {
  if (!isVerticalEnabled("venue")) {
    redirect("/unauthorized");
  }

  const user = await getDashboardSessionUser();
  if (!user) {
    redirect(`/login?from=${agencyIdProp ? `/${encodeURIComponent(agencyIdProp)}` : "/app/venue"}`);
  }

  const agencyId = agencyIdProp?.trim() || user.agencyId;
  const roleVertical = verticalFromRole(user.role);
  const claimMatches = user.agencyId.trim() === agencyId.trim();
  if (roleVertical !== "venue" && !claimMatches) {
    redirect(dashboardRouteFromRole(user.role, user.agencyId));
  }

  const roleToken = user.role.trim().toUpperCase();
  if (!VENUE_CONSOLE_ROLES.has(roleToken) && roleVertical !== "venue") {
    redirect(dashboardRouteFromRole(user.role, user.agencyId));
  }

  const venueCode = extractVenueCode(agencyId);
  const venueName = profile?.name ?? (await resolveVenueDisplayName(venueCode));

  return (
    <VenueConsoleHome
      agencyId={agencyId}
      venueCode={venueCode}
      venueName={venueName}
      displayName={dashboardDisplayName(user)}
      userEmail={user.email ?? ""}
      userRole={user.role}
    />
  );
}
