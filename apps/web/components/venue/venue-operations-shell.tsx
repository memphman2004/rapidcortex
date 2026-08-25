"use client";

import type { ReactNode } from "react";
import { Ticket } from "lucide-react";
import { CampusDashboardHeaderUtilities } from "@/components/campus/campus-dashboard-header-utilities";
import { HelpChrome } from "@/components/help/help-chrome";
import { ThemeProvider, useThemeRoot } from "@/lib/theme/theme-context";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { VENUE_DASHBOARD_FONT_FAMILY } from "./venue-dashboard-font";
import { extractVenueCode } from "@/lib/auth/post-login-redirect";
import { VenueNav } from "./venue-nav";
import type { VenueThreatLevel } from "./venue-threat-strip";
import { venueThreatLabel } from "./venue-threat-strip";

export function VenueOperationsShell(props: {
  venueName: string;
  linkBase: string;
  userEmail?: string;
  userRole?: string;
  agencyId: string;
  userId?: string;
  threatLevel?: VenueThreatLevel;
  children: ReactNode;
}) {
  return (
    <ThemeProvider storageKey="rc-theme-venue">
      <VenueOperationsShellInner {...props} />
    </ThemeProvider>
  );
}

function VenueOperationsShellInner({
  venueName,
  linkBase,
  userEmail,
  userRole,
  agencyId,
  userId,
  threatLevel = "secure",
  children,
}: {
  venueName: string;
  linkBase: string;
  userEmail?: string;
  userRole?: string;
  agencyId: string;
  userId?: string;
  threatLevel?: VenueThreatLevel;
  children: ReactNode;
}) {
  const { theme, rootRef } = useThemeRoot<HTMLDivElement>();

  return (
    <HelpChrome role={userRole ?? "venue_admin"}>
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
          padding: "0 16px",
          height: 52,
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "var(--rc-surface-alt)",
              border: `1px solid var(--rc-border)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ticket size={16} color="var(--rc-amber)" />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Rapid Cortex</div>
            <div style={{ fontSize: 10, color: "var(--rc-text-secondary)", letterSpacing: "0.05em" }}>
              VENUE OPERATIONS
            </div>
          </div>
        </div>

        <div style={{ width: 1, height: 28, background: "var(--rc-border)" }} />

        <span
          style={{
            background: "var(--rc-surface-alt)",
            border: `1px solid var(--rc-border)`,
            borderRadius: 6,
            padding: "3px 10px",
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          {venueName.toUpperCase()}
        </span>
        <span
          style={{
            background: "var(--rc-green-dim)",
            border: "1px solid var(--rc-green-border)",
            borderRadius: 6,
            padding: "3px 10px",
            fontSize: 11,
            color: "var(--rc-green)",
            fontWeight: 600,
          }}
        >
          PROD
        </span>
        <span
          style={{
            background: "var(--rc-surface-alt)",
            border: `1px solid var(--rc-border)`,
            borderRadius: 6,
            padding: "3px 10px",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.06em",
            color: "var(--rc-amber)",
          }}
        >
          {venueThreatLabel(threatLevel)}
        </span>

        <div style={{ flex: 1 }} />

        {/(supervisor)/i.test(userRole ?? "") ? (
          <a
            href={`/app/venue/${extractVenueCode(agencyId)}/supervisor`}
            style={{ fontSize: 12, color: "var(--rc-amber)", fontWeight: 600, marginRight: 8 }}
          >
            📱 Mobile view
          </a>
        ) : null}

        <CampusDashboardHeaderUtilities
          email={userEmail}
          role={userRole}
          agencyId={agencyId}
          userId={userId}
          leadingSlot={<ThemeToggle variant="inline" />}
        />
      </header>

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <VenueNav linkBase={linkBase} userRole={userRole} />
        <main style={{ flex: 1, overflow: "auto", minWidth: 0 }}>{children}</main>
      </div>
    </div>
    </HelpChrome>
  );
}
