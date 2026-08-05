import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { dashboardRouteFromRole } from "rapid-cortex-shared";
import { VenueConsoleHome } from "@/components/venue/venue-console-home";
import { extractVenueCode } from "@/lib/auth/post-login-redirect";
import { dashboardDisplayName } from "@/lib/dashboards/dashboard-display-name";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { resolveVenueDisplayName } from "@/lib/venue/venue-tenant";

type VenueDashboardParams = { venueCode: string };

const OPERATIONAL_ROLES = new Set(["VENUE_SECURITY", "VENUE_SUPERVISOR", "VENUE_OPERATOR"]);

export async function generateMetadata({
  params,
}: {
  params: Promise<VenueDashboardParams>;
}): Promise<Metadata> {
  const { venueCode } = await params;
  return {
    title: `${venueCode} Operations | Rapid Cortex Venue`,
  };
}

export default async function VenueDashboardPage({
  params,
}: {
  params: Promise<VenueDashboardParams>;
}) {
  const { venueCode } = await params;
  const user = await getDashboardSessionUser();
  if (!user) return null;

  const roleToken = user.role.trim().toUpperCase();
  if (OPERATIONAL_ROLES.has(roleToken)) {
    redirect(dashboardRouteFromRole(user.role, user.agencyId));
  }

  const code = venueCode.toUpperCase();
  const agencyId = user.agencyId;
  const resolvedCode = extractVenueCode(agencyId) || code;
  const venueName = await resolveVenueDisplayName(resolvedCode);

  return (
    <VenueConsoleHome
      agencyId={agencyId}
      venueCode={resolvedCode}
      venueName={venueName}
      displayName={dashboardDisplayName(user)}
      userEmail={user.email ?? ""}
      userRole={user.role}
      userId={user.userId}
    />
  );
}
