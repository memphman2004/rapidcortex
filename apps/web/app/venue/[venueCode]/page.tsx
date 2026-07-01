import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { dashboardRouteFromRole } from "rapid-cortex-shared";
import { VenueDashboardHome } from "@/components/dashboards/DashboardHomeRenderer";
import { dashboardDisplayName } from "@/lib/dashboards/dashboard-display-name";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { normalizeVenueRole } from "@/lib/venue/venue-dashboard-sections";

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
  const role = normalizeVenueRole(user?.role);
  if (!user) return null;

  const roleToken = user.role.trim().toUpperCase();
  if (OPERATIONAL_ROLES.has(roleToken)) {
    redirect(dashboardRouteFromRole(user.role, user.agencyId));
  }

  return (
    <VenueDashboardHome
      venueCode={venueCode}
      role={role}
      agencyId={user.agencyId}
      displayName={dashboardDisplayName(user)}
    />
  );
}
