import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isVenueGuestServicesRole } from "@/lib/venue/venue-guest-services";
import { VenueGuestServicesDisclaimer } from "./venue-guest-services-disclaimer";

/** Renders the guest-services disclaimer when the signed-in user has that role. */
export async function VenueGuestServicesDisclaimerGate({
  className,
}: {
  className?: string;
}) {
  const user = await getDashboardSessionUser();
  if (!isVenueGuestServicesRole(user?.role)) return null;
  return <VenueGuestServicesDisclaimer className={className} />;
}
