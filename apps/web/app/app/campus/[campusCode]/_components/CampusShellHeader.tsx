"use client";

import type { ReactNode } from "react";
import { VerticalDisclaimerBanner } from "@/components/vertical/vertical-disclaimer-banner";
import { CampusDashboardHeaderUtilities } from "@/components/campus/campus-dashboard-header-utilities";

const C = {
  surface: "var(--rc-surface)",
  border: "var(--rc-border)",
  borderHard: "var(--rc-border-hard)",
  text: "var(--rc-text-primary)",
  textMuted: "var(--rc-text-muted)",
  blue: "var(--rc-blue)",
  crestBg: "var(--rc-crest)",
} as const;

const roleBadgeMap: Record<string, string> = {
  CAMPUS_ADMIN: "CAMPUS ADMIN",
  CAMPUS_SUPERVISOR: "SUPERVISOR",
  CAMPUS_SECURITY: "SECURITY",
  CAMPUS_DISPATCH: "DISPATCH",
  CAMPUS_FACULTY: "FACULTY",
  CAMPUS_COUNSELOR: "COUNSELOR",
};

function crestAbbr(campusCode: string): string {
  const cleaned = campusCode.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (cleaned.length <= 3) return cleaned || "RC";
  return cleaned.slice(0, 3);
}

export function CampusShellHeader({
  campusCode,
  role = "CAMPUS_SUPERVISOR",
  userEmail,
  agencyId,
  leadingSlot,
}: {
  campusCode: string;
  role?: string;
  userEmail?: string;
  agencyId?: string;
  /** Rendered immediately left of Help / Font (e.g. ThemeToggle). */
  leadingSlot?: ReactNode;
}) {
  const badge = roleBadgeMap[role.trim().toUpperCase()] ?? role;
  const abbr = crestAbbr(campusCode);

  return (
    <header
      className="mb-3 rounded-[10px] px-4 py-3"
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[7px] text-[10px] font-bold text-white"
            style={{
              background: C.crestBg,
              border: `2px solid ${C.borderHard}`,
            }}
          >
            {abbr}
          </div>
          <div>
            <p
              className="text-[9px] font-bold tracking-[2.5px]"
              style={{ color: C.blue }}
            >
              RAPID CORTEX · CAMPUS
            </p>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-bold" style={{ color: C.text }}>
                {campusCode}
              </h1>
              <span
                className="rounded px-2 py-0.5 text-[10px] font-semibold"
                style={{
                  color: C.textMuted,
                  border: `1px solid ${C.border}`,
                  background: "rgba(255,255,255,0.04)",
                }}
              >
                {badge}
              </span>
            </div>
            <p className="mt-0.5 text-[11px]" style={{ color: C.textMuted }}>
              Public Safety · NOT A 911 DISPATCH CONSOLE
            </p>
          </div>
        </div>
        <CampusDashboardHeaderUtilities
          email={userEmail}
          role={role}
          agencyId={agencyId}
          leadingSlot={leadingSlot}
        />
      </div>
      <div className="mt-3">
        <VerticalDisclaimerBanner
          tone="slate"
          message="Campus safety reporting only — escalate to your public safety agency for emergencies."
        />
      </div>
    </header>
  );
}
