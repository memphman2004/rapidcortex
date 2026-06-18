"use client";

import type { ReactNode } from "react";
import { Ticket } from "lucide-react";
import { CampusDashboardHeaderUtilities } from "@/components/campus/campus-dashboard-header-utilities";
import { VENUE_DASHBOARD_FONT_FAMILY } from "./venue-dashboard-font";
import { VenueNav } from "./venue-nav";
import type { VenueThreatLevel } from "./venue-threat-strip";
import { venueThreatLabel } from "./venue-threat-strip";

const V = {
  bg: "#0c0b14",
  surface: "#100e1a",
  border: "#1e1a30",
  amber: "#f59e0b",
  textSecondary: "#5a4d7a",
};

export function VenueOperationsShell({
  venueName,
  linkBase,
  userEmail,
  userRole,
  agencyId,
  threatLevel = "secure",
  children,
}: {
  venueName: string;
  linkBase: string;
  userEmail?: string;
  userRole?: string;
  agencyId: string;
  threatLevel?: VenueThreatLevel;
  children: ReactNode;
}) {
  return (
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
              background: "#141220",
              border: `1px solid ${V.border}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ticket size={16} color={V.amber} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Rapid Cortex</div>
            <div style={{ fontSize: 10, color: V.textSecondary, letterSpacing: "0.05em" }}>
              VENUE OPERATIONS
            </div>
          </div>
        </div>

        <div style={{ width: 1, height: 28, background: V.border }} />

        <span
          style={{
            background: "#141220",
            border: `1px solid ${V.border}`,
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
            background: "#142b1a",
            border: "1px solid #1e5c2a",
            borderRadius: 6,
            padding: "3px 10px",
            fontSize: 11,
            color: "#10b981",
            fontWeight: 600,
          }}
        >
          PROD
        </span>
        <span
          style={{
            background: "#141220",
            border: `1px solid ${V.border}`,
            borderRadius: 6,
            padding: "3px 10px",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.06em",
            color: V.amber,
          }}
        >
          {venueThreatLabel(threatLevel)}
        </span>

        <div style={{ flex: 1 }} />

        <CampusDashboardHeaderUtilities
          email={userEmail}
          role={userRole}
          agencyId={agencyId}
        />
      </header>

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <VenueNav linkBase={linkBase} userRole={userRole} />
        <main style={{ flex: 1, overflow: "auto", minWidth: 0 }}>{children}</main>
      </div>
    </div>
  );
}
