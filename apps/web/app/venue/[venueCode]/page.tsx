import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { VenueDashboardHome } from "@/components/dashboards/DashboardHomeRenderer";
import { dashboardDisplayName } from "@/lib/dashboards/dashboard-display-name";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { normalizeVenueRole } from "@/lib/venue/venue-dashboard-sections";

type VenueDashboardParams = { venueCode: string };

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
  if (role === "VENUE_GUEST_SERVICES") {
    redirect(`/app/venue/${venueCode}/reports`);
  }
  if (!user) return null;

  return (
    <VenueDashboardHome
      venueCode={venueCode}
      role={role}
      agencyId={user.agencyId}
      displayName={dashboardDisplayName(user)}
    />
  );
}
