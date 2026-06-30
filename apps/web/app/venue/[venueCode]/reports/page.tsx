import { redirect } from "next/navigation";
import { dashboardRouteFromRole } from "rapid-cortex-shared";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isVenueGuestServicesRole } from "@/lib/venue/venue-guest-services";
import { VenueGuestReportsClient } from "./reports-client";

export default async function GuestReportsPage({
  params,
}: {
  params: Promise<{ venueCode: string }>;
}) {
  const user = await getDashboardSessionUser();
  if (user && isVenueGuestServicesRole(user.role)) {
    redirect(dashboardRouteFromRole(user.role, user.agencyId));
  }

  return <VenueGuestReportsClient params={params} />;
}
