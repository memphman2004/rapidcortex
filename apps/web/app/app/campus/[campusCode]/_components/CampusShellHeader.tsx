"use client";

import type { ReactNode } from "react";
import { CAMPUS_INSTITUTION_LABELS, buildPsapAvailabilityNotice } from "rapid-cortex-shared";
import { CampusDashboardHeaderUtilities } from "@/components/campus/campus-dashboard-header-utilities";
import { CampusSiteSwitcher } from "@/components/campus/campus-site-switcher";
import { useCampusSiteScope } from "@/lib/campus/use-campus-site-scope";
import { useCampusInstitutionType } from "@/lib/campus/use-campus-institution";
import { PSAPAvailabilityNotice } from "@/components/psap/psap-availability-notice";

const C = {
  surface: "var(--rc-surface)",
  border: "var(--rc-border)",
  borderHard: "var(--rc-border-hard)",
  text: "var(--rc-text-primary)",
  textMuted: "var(--rc-text-muted)",
  blue: "var(--rc-blue)",
  crestBg: "var(--rc-crest)",
} as const;

const roleBadgeMap: Record<string, { higher_ed: string; k12: string }> = {
  CAMPUS_ADMIN: { higher_ed: "CAMPUS ADMIN", k12: "K-12 ADMIN" },
  CAMPUS_SUPERVISOR: { higher_ed: "SUPERVISOR", k12: "K-12 SUPERVISOR" },
  CAMPUS_SECURITY: { higher_ed: "SECURITY", k12: "K-12 SECURITY" },
  CAMPUS_DISPATCH: { higher_ed: "DISPATCH", k12: "K-12 DISPATCH" },
  CAMPUS_FACULTY: { higher_ed: "FACULTY", k12: "K-12 STAFF" },
  CAMPUS_COUNSELOR: { higher_ed: "COUNSELOR", k12: "K-12 COUNSELOR" },
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
  const { institutionType } = useCampusInstitutionType();
  const badges = roleBadgeMap[role.trim().toUpperCase()];
  const badge = badges?.[institutionType] ?? role;
  const abbr = crestAbbr(campusCode);
  const { scope, setScope, sites } = useCampusSiteScope(agencyId ?? "");
  const productLine =
    institutionType === "k12" ? "NEXCORT IQ · K-12" : "NEXCORT IQ · UNIVERSITY / COLLEGE";
  const productSub =
    institutionType === "k12"
      ? `${CAMPUS_INSTITUTION_LABELS.k12} · NOT A 911 DISPATCH CONSOLE`
      : `${CAMPUS_INSTITUTION_LABELS.higher_ed} · NOT A 911 DISPATCH CONSOLE`;

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
              {productLine}
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
              {productSub}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-start justify-end gap-3">
          <div className="min-w-[11rem]">
            <CampusSiteSwitcher sites={sites} value={scope} onChange={setScope} variant="console" />
          </div>
          <CampusDashboardHeaderUtilities
            email={userEmail}
            role={role}
            agencyId={agencyId}
            leadingSlot={leadingSlot}
          />
        </div>
      </div>
      <div className="mt-3">
        <PSAPAvailabilityNotice
          notice={buildPsapAvailabilityNotice({ product: "campus", agencyName: campusCode })}
          compact
        />
      </div>
    </header>
  );
}
