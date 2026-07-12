import type { ReactNode } from "react";
import { CampusDashboardHeaderUtilities } from "@/components/campus/campus-dashboard-header-utilities";
import { HelpChrome } from "@/components/help/help-chrome";
import { VENUE_DASHBOARD_FONT_FAMILY } from "./venue-dashboard-font";
import { VenueGuestServicesDisclaimer } from "./venue-guest-services-disclaimer";

const V = {
  bg: "#0c0b14",
  surface: "#100e1a",
  border: "#1e1a30",
  amber: "#f59e0b",
  textSecondary: "#5a4d7a",
};

/** Minimal chrome for guest-services — no ops nav, cameras, staff, or incident links. */
export function VenueGuestServicesPageFrame({
  venueName,
  userEmail,
  userRole,
  agencyId,
  children,
}: {
  venueName: string;
  userEmail?: string;
  userRole?: string;
  agencyId: string;
  children: ReactNode;
}) {
  return (
    <HelpChrome role={userRole ?? "VENUE_GUEST_SERVICES"}>
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: V.bg,
        color: "#e4dff5",
        fontFamily: VENUE_DASHBOARD_FONT_FAMILY,
      }}
    >
      <header
        style={{
          background: V.surface,
          borderBottom: `1px solid ${V.border}`,
          padding: "12px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: V.textSecondary, letterSpacing: "0.05em" }}>
              GUEST SERVICES
            </div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{venueName}</div>
          </div>
          <CampusDashboardHeaderUtilities
            email={userEmail}
            role={userRole}
            agencyId={agencyId}
          />
        </div>
        <VenueGuestServicesDisclaimer />
      </header>
      <main style={{ flex: 1, overflow: "auto", minWidth: 0 }}>{children}</main>
    </div>
    </HelpChrome>
  );
}
