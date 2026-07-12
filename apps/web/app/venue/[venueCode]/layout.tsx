import { VenueHeader } from "./_components/VenueHeader";
import { VenueNav } from "./_components/VenueNav";
import { VENUE_DASHBOARD_FONT_FAMILY } from "@/components/venue/venue-dashboard-font";
import { VenueGuestServicesDisclaimerGate } from "@/components/venue/venue-guest-services-disclaimer-gate";
import { HelpChrome } from "@/components/help/help-chrome";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { normalizeVenueRole } from "@/lib/venue/venue-dashboard-sections";
import { isVenueGuestServicesRole } from "@/lib/venue/venue-guest-services";
import { venueNavKeysForRole } from "@/lib/venue/venue-nav-access";

export default async function VenueLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ venueCode: string }>;
}) {
  const { venueCode } = await params;
  const user = await getDashboardSessionUser();
  const role = normalizeVenueRole(user?.role);
  const navKeys = venueNavKeysForRole(role);
  const isGuestServices = isVenueGuestServicesRole(user?.role);

  return (
    <HelpChrome role={role}>
      <div
        className="min-h-screen bg-slate-950 text-slate-100"
        style={{ fontFamily: VENUE_DASHBOARD_FONT_FAMILY }}
      >
        <div className="mx-auto max-w-[1400px] space-y-4 p-4">
          <VenueGuestServicesDisclaimerGate className="mb-2" />
          <VenueHeader
            venueCode={venueCode}
            role={role}
            userEmail={user?.email}
            agencyId={user?.agencyId}
          />
          <div className="flex flex-col gap-4 lg:flex-row">
            {!isGuestServices && navKeys.length > 0 ? (
              <VenueNav venueCode={venueCode} role={role} />
            ) : null}
            <main className="min-w-0 flex-1">{children}</main>
          </div>
        </div>
      </div>
    </HelpChrome>
  );
}
