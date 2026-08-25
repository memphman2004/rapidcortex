"use client";

import { useMemo, type CSSProperties } from "react";
import { useSession } from "@/components/auth/session-context";
import { isAuthConfigured } from "@/lib/auth/roles";
import { SidebarHomeButton } from "@/components/ui/sidebar-home-button";
import { SidebarSignOutFooter } from "@/components/ui/sidebar-sign-out-footer";
import { RoleNavSections } from "@/components/navigation/role-nav-sidebar";
import { buildNavContext } from "@/lib/navigation/nav-context";
import { filterRoleNavByFeatures } from "@/lib/navigation/filter-role-nav";
import { getRoleNav } from "@/lib/navigation/role-nav";
import { useNavBadgeCounts } from "@/lib/navigation/use-nav-badge-counts";
import { useOptionalJurisdictionSlug } from "@/lib/jurisdiction-context";
import { defaultJurisdictionSlug } from "@/lib/marketing-links";
import { ModulePicker } from "@/components/dispatch/module-dock";
import { useDispatcherModuleRail } from "@/components/dispatch/dispatcher-module-rail-context";

export function SideNav({ compactRail = false }: { compactRail?: boolean }) {
  const moduleRail = useDispatcherModuleRail();
  const { user, isLoading } = useSession();
  const auth = isAuthConfigured();
  const jurisdictionSlug = useOptionalJurisdictionSlug() ?? defaultJurisdictionSlug();
  const counts = useNavBadgeCounts(user?.role);

  const nav = useMemo(() => {
    if (!user) return null;
    const ctx = buildNavContext(user, jurisdictionSlug);
    return filterRoleNavByFeatures(getRoleNav(user.role, ctx));
  }, [user, jurisdictionSlug]);

  const palette =
    nav?.accent === "violet"
      ? { accent: "#C084FC", dim: "#3B1157" }
      : nav?.accent === "orange"
        ? { accent: "#F97316", dim: "#7C2D12" }
        : nav?.accent === "teal"
          ? { accent: "#14B8A6", dim: "#134E4A" }
          : nav?.accent === "slate"
            ? { accent: "#94A3B8", dim: "#1E293B" }
            : { accent: "#3b82f6", dim: "#1e3a5f" };

  return (
    <nav
      className={
        compactRail
          ? "dispatcher-nav-rail flex h-full min-h-0 shrink-0 flex-col"
          : "flex h-full min-h-0 w-56 shrink-0 flex-col sm:w-[var(--rc-sidebar-ops)] xl:w-[var(--rc-sidebar-ops-xl)]"
      }
      aria-label="Operations and administration"
      style={
        {
          "--role-accent": palette.accent,
          "--role-accent-dim": palette.dim,
          background: "var(--rc-panel-bg)",
          borderRight: "1px solid var(--rc-border)",
        } as CSSProperties
      }
    >
      <div className="min-h-0 flex-1 overflow-y-auto py-3 xl:py-4">
        {auth && !isLoading && user ? (
          <div className="px-2 pb-2">
            <SidebarHomeButton user={user} className="w-full" />
          </div>
        ) : null}

        {nav ? (
          <div className="px-1">
            <RoleNavSections nav={nav} counts={counts} />
            {moduleRail?.rail ? (
              <div className="pt-1">
                <div className="flex items-center gap-2.5 px-2 pt-4 pb-1">
                  <span className="shrink-0 whitespace-nowrap text-[9px] font-bold uppercase tracking-widest text-[var(--rc-text-muted)]">
                    Modules
                  </span>
                  <div className="h-px flex-1 bg-[var(--rc-border)]" aria-hidden />
                </div>
                <ModulePicker dock={moduleRail.rail.dock} onOpenModule={moduleRail.rail.onOpen} />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      {auth && !isLoading && user ? <SidebarSignOutFooter email={user.email} /> : null}
    </nav>
  );
}
