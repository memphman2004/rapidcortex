"use client";

import { CampusDashboardHeaderUtilities } from "@/components/campus/campus-dashboard-header-utilities";

const roleLabelMap: Record<string, string> = {
  VENUE_ADMIN: "VENUE ADMIN",
  VENUE_SUPERVISOR: "SUPERVISOR",
  VENUE_SECURITY: "SECURITY",
  VENUE_OPERATOR: "OPERATOR",
  VENUE_GUEST_SERVICES: "GUEST SERVICES",
};

export function VenueHeader({
  venueCode,
  role = "VENUE_SUPERVISOR",
  userEmail,
  agencyId,
}: {
  venueCode: string;
  role?: string;
  userEmail?: string;
  agencyId?: string;
}) {
  const roleLabel = roleLabelMap[role] ?? role;

  return (
    <header
      className="rounded-lg px-4 py-3"
      style={{
        background: "#0e0c1a",
        border: "1px solid rgba(245,158,11,0.28)",
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p
            className="text-xs uppercase tracking-wide"
            style={{ color: "rgba(245,158,11,0.85)" }}
          >
            Rapid Cortex Venue
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold" style={{ color: "#e4dff5" }}>
              {venueCode}
            </h1>
            <span
              className="rounded-full px-2.5 py-1 text-xs font-semibold"
              style={{
                border: "1px solid rgba(245,158,11,0.4)",
                background: "rgba(245,158,11,0.15)",
                color: "#fcd34d",
              }}
            >
              {roleLabel}
            </span>
          </div>
          <p className="mt-1 text-sm" style={{ color: "#7c6fa0" }}>
            {role === "VENUE_GUEST_SERVICES"
              ? "Guest services inbox"
              : role === "VENUE_OPERATOR"
                ? "Venue operator console"
                : "Game day operations console"}
          </p>
        </div>
        <CampusDashboardHeaderUtilities email={userEmail} role={role} agencyId={agencyId} />
      </div>
    </header>
  );
}
