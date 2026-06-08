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

export function SideNav() {
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
            : { accent: "#0284C7", dim: "#0C4A6E" };

  return (
    <nav
      className="flex h-full min-h-0 w-56 shrink-0 flex-col border-r border-slate-800 bg-slate-950/90 sm:w-[var(--rc-sidebar-ops)] xl:w-[var(--rc-sidebar-ops-xl)]"
      aria-label="Operations and administration"
      style={
        {
          "--role-accent": palette.accent,
          "--role-accent-dim": palette.dim,
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
          </div>
        ) : null}
      </div>
      {auth && !isLoading && user ? <SidebarSignOutFooter email={user.email} /> : null}
    </nav>
  );
}
