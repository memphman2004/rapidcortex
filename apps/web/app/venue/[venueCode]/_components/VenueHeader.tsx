"use client";

import { CampusDashboardHeaderUtilities } from "@/components/campus/campus-dashboard-header-utilities";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

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
        background: "var(--rc-surface)",
        border: "1px solid var(--rc-border)",
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p
            className="text-xs uppercase tracking-wide"
            style={{ color: "var(--rc-amber)" }}
          >
            Rapid Cortex Venue
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold" style={{ color: "var(--rc-text-primary)" }}>
              {venueCode}
            </h1>
            <span
              className="rounded-full px-2.5 py-1 text-xs font-semibold"
              style={{
                border: "1px solid var(--rc-amber-border)",
                background: "var(--rc-amber-dim)",
                color: "var(--rc-amber)",
              }}
            >
              {roleLabel}
            </span>
          </div>
          <p className="mt-1 text-sm" style={{ color: "var(--rc-text-muted)" }}>
            {role === "VENUE_GUEST_SERVICES"
              ? "Guest services inbox"
              : role === "VENUE_OPERATOR"
                ? "Venue operator console"
                : "Game day operations console"}
          </p>
        </div>
        <CampusDashboardHeaderUtilities
          email={userEmail}
          role={role}
          agencyId={agencyId}
          leadingSlot={<ThemeToggle variant="inline" />}
        />
      </div>
    </header>
  );
}
