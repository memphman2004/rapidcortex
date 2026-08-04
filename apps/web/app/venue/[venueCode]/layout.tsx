import { VENUE_DASHBOARD_FONT_FAMILY } from "@/components/venue/venue-dashboard-font";
import { VenueShellChrome } from "@/components/venue/venue-shell-chrome";
import { HelpChrome } from "@/components/help/help-chrome";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { normalizeVenueRole } from "@/lib/venue/venue-dashboard-sections";
import { isVenueGuestServicesRole } from "@/lib/venue/venue-guest-services";
import { venueNavKeysForRole } from "@/lib/venue/venue-nav-access";

/** Matches venue console mockup tokens (bg / surface). */
const SHELL = {
  bg: "#09090f",
  surface: "#0e0c1a",
  text: "#e4dff5",
} as const;

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
        className="min-h-screen"
        style={{
          background: SHELL.bg,
          color: SHELL.text,
          fontFamily: VENUE_DASHBOARD_FONT_FAMILY,
        }}
      >
        <VenueShellChrome
          venueCode={venueCode}
          role={role}
          userEmail={user?.email}
          agencyId={user?.agencyId}
          isGuestServices={isGuestServices}
          showNav={!isGuestServices && navKeys.length > 0}
        >
          {children}
        </VenueShellChrome>
      </div>
    </HelpChrome>
  );
}
