"use client";

import type { ReactNode } from "react";
import { CampusDashboardHeaderUtilities } from "@/components/campus/campus-dashboard-header-utilities";
import { HelpChrome } from "@/components/help/help-chrome";
import { ThemeProvider, useThemeRoot } from "@/lib/theme/theme-context";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { VENUE_DASHBOARD_FONT_FAMILY } from "./venue-dashboard-font";
import { VenueGuestServicesDisclaimer } from "./venue-guest-services-disclaimer";

/** Minimal chrome for guest-services — no ops nav, cameras, staff, or incident links. */
export function VenueGuestServicesPageFrame(props: {
  venueName: string;
  userEmail?: string;
  userRole?: string;
  agencyId: string;
  userId?: string;
  children: ReactNode;
}) {
  return (
    <ThemeProvider storageKey="rc-theme-venue">
      <VenueGuestServicesPageFrameInner {...props} />
    </ThemeProvider>
  );
}

function VenueGuestServicesPageFrameInner({
  venueName,
  userEmail,
  userRole,
  agencyId,
  userId,
  children,
}: {
  venueName: string;
  userEmail?: string;
  userRole?: string;
  agencyId: string;
  userId?: string;
  children: ReactNode;
}) {
  const { theme, rootRef } = useThemeRoot<HTMLDivElement>();

  return (
    <HelpChrome role={userRole ?? "VENUE_GUEST_SERVICES"}>
    <div
      ref={rootRef}
      data-theme={theme}
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--rc-bg)",
        color: "var(--rc-text-primary)",
        colorScheme: theme,
        fontFamily: VENUE_DASHBOARD_FONT_FAMILY,
      }}
    >
      <header
        style={{
          background: "var(--rc-surface)",
          borderBottom: `1px solid var(--rc-border)`,
          padding: "12px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: "var(--rc-text-secondary)", letterSpacing: "0.05em" }}>
              GUEST SERVICES
            </div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{venueName}</div>
          </div>
          <CampusDashboardHeaderUtilities
            email={userEmail}
            role={userRole}
            agencyId={agencyId}
            userId={userId}
            leadingSlot={<ThemeToggle variant="inline" />}
          />
        </div>
        <VenueGuestServicesDisclaimer />
      </header>
      <main style={{ flex: 1, overflow: "auto", minWidth: 0 }}>{children}</main>
    </div>
    </HelpChrome>
  );
}
