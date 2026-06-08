"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { isRcSuperAdmin } from "rapid-cortex-security";
import type { UserContext } from "rapid-cortex-shared/types";
import { useSearchParams } from "next/navigation";
import type { DashboardPrefix } from "@/lib/dashboards/dashboard-access";
import {
  getRoleDashboardIdentity,
  roleDashboardShellVars,
} from "@/lib/dashboards/role-dashboard-design";
import { RoleNavSidebar } from "@/components/navigation/role-nav-sidebar";
import { TopNav } from "./top-nav";
import { RoleDashboardHeaderStrip } from "./role-dashboard-header-strip";
import { RoleDashboardHomeLayout } from "./role-dashboard-home-layout";
import { VERTICAL_CONFIG, normalizeVertical } from "@/lib/vertical";
import { VerticalBadge } from "@/components/ui/VerticalBadge";
import { ActiveNoticesBanner } from "@/components/notices/ActiveNoticesBanner";

const IMPERSONATION_STORAGE_KEY = "rc-impersonation-context-v1";

type ImpersonationContext = {
  agencyId: string;
  agencyName: string;
  vertical: keyof typeof VERTICAL_CONFIG;
  planTier: string;
};

export function DashboardShell({
  prefix,
  user,
  children,
}: {
  prefix: DashboardPrefix;
  user: UserContext;
  children: React.ReactNode;
}) {
  const [mobileNav, setMobileNav] = useState(false);
  const [impersonation, setImpersonation] = useState<ImpersonationContext | null>(null);
  const searchParams = useSearchParams();
  const identity = getRoleDashboardIdentity(prefix, user.role);
  const isSuperAdmin = isRcSuperAdmin(user.role);

  useEffect(() => {
    if (!isSuperAdmin) return;
    const qAgencyId = searchParams.get("impersonateAgencyId")?.trim();
    const qAgencyName = searchParams.get("impersonateAgencyName")?.trim();
    const qPlanTier = searchParams.get("impersonatePlanTier")?.trim();
    const qVertical = searchParams.get("impersonateVertical");
    if (qAgencyId) {
      const next: ImpersonationContext = {
        agencyId: qAgencyId,
        agencyName: qAgencyName || qAgencyId,
        vertical: normalizeVertical(qVertical),
        planTier: qPlanTier || "starter",
      };
      setImpersonation(next);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(IMPERSONATION_STORAGE_KEY, JSON.stringify(next));
      }
      return;
    }
    if (typeof window !== "undefined") {
      const raw = window.localStorage.getItem(IMPERSONATION_STORAGE_KEY);
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw) as Partial<ImpersonationContext>;
        if (!parsed?.agencyId) return;
        setImpersonation({
          agencyId: parsed.agencyId,
          agencyName: parsed.agencyName || parsed.agencyId,
          vertical: normalizeVertical(parsed.vertical),
          planTier: parsed.planTier || "starter",
        });
      } catch {
        window.localStorage.removeItem(IMPERSONATION_STORAGE_KEY);
      }
    }
  }, [isSuperAdmin, searchParams]);

  const shellVars = roleDashboardShellVars(identity) as CSSProperties;

  return (
    <div
      className="min-h-screen bg-[#030712] text-slate-100"
      style={{
        ...shellVars,
        fontFamily: "var(--rc-dashboard-font-family, \"Courier New\", monospace)",
      }}
    >
      {mobileNav ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/60 md:hidden"
          aria-label="Close menu"
          onClick={() => setMobileNav(false)}
        />
      ) : null}
      <div className="flex min-h-screen">
        <RoleNavSidebar
          user={user}
          mobileOpen={mobileNav}
          onNavigate={() => setMobileNav(false)}
        />
        <div className="flex min-w-0 flex-1 flex-col md:pl-0">
          <TopNav identity={identity} user={user} onMenuClick={() => setMobileNav(true)} />
          {isSuperAdmin && impersonation ? (
            <div
              className="border-b px-4 py-2 text-xs font-semibold md:px-6"
              style={{
                color: VERTICAL_CONFIG[impersonation.vertical].color,
                borderColor: VERTICAL_CONFIG[impersonation.vertical].color,
                backgroundColor: VERTICAL_CONFIG[impersonation.vertical].bg,
              }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span>IMPERSONATING: {impersonation.agencyName}</span>
                <span aria-hidden>·</span>
                <VerticalBadge vertical={impersonation.vertical} size="xs" />
                <span aria-hidden>·</span>
                <span className="uppercase">{impersonation.planTier}</span>
                <button
                  type="button"
                  className="ml-auto rounded border px-2 py-0.5 text-[10px] font-medium"
                  style={{
                    color: VERTICAL_CONFIG[impersonation.vertical].color,
                    borderColor: VERTICAL_CONFIG[impersonation.vertical].color,
                  }}
                  onClick={() => {
                    setImpersonation(null);
                    if (typeof window !== "undefined") {
                      window.localStorage.removeItem(IMPERSONATION_STORAGE_KEY);
                    }
                  }}
                >
                  End impersonation banner
                </button>
              </div>
            </div>
          ) : null}
          <ActiveNoticesBanner />
          <RoleDashboardHeaderStrip prefix={prefix} user={user} />
          <main className="flex-1 bg-gradient-to-b from-[#050b14] via-slate-950 to-slate-950 p-4 md:p-6">
            <RoleDashboardHomeLayout prefix={prefix}>{children}</RoleDashboardHomeLayout>
          </main>
        </div>
      </div>
    </div>
  );
}
