"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback } from "react";
import { usePathname } from "next/navigation";
import type { UserContext } from "rapid-cortex-shared/types";
import type { DashboardPrefix } from "@/lib/dashboards/dashboard-access";
import type { NavTab } from "@/lib/dashboards/role-dashboard-config";
import { resolveRoleNavHref } from "@/lib/dashboards/jurisdiction-nav";
import { getRoleDashboardIdentity } from "@/lib/dashboards/role-dashboard-design";
import { sidebarIconForTab } from "@/lib/dashboards/role-sidebar-icons";
import { SidebarHomeButton } from "@/components/ui/sidebar-home-button";
import { SidebarSignOutFooter } from "@/components/ui/sidebar-sign-out-footer";
import { useOptionalJurisdictionSlug } from "@/lib/jurisdiction-context";
import { defaultJurisdictionSlug } from "@/lib/marketing-links";

function navItemIsActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  return pathname.startsWith(`${href}/`);
}

export function RoleSidebar({
  prefix,
  tabs,
  mobileOpen,
  onNavigate,
  user,
}: {
  prefix: DashboardPrefix;
  tabs: NavTab[];
  mobileOpen: boolean;
  onNavigate?: () => void;
  user?: UserContext;
}) {
  const pathname = usePathname();
  const jurisdictionSlug = useOptionalJurisdictionSlug() ?? defaultJurisdictionSlug();
  const identity = getRoleDashboardIdentity(prefix, user?.role);

  const resolveNavHref = useCallback(
    (tab: NavTab): string => resolveRoleNavHref(prefix, tab, jurisdictionSlug),
    [jurisdictionSlug, prefix],
  );

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 w-60 transform border-r border-slate-800/90 bg-[#050b14] pt-14 transition-transform md:static md:z-0 md:translate-x-0 md:pt-0 ${
        mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      }`}
      style={{
        borderRightColor: "color-mix(in srgb, var(--role-accent) 22%, rgb(30 41 59))",
        borderTop: "3px solid var(--role-accent)",
      }}
    >
      <div className="flex h-full flex-col px-3 py-4">
        <div className="mb-5 hidden px-1 md:flex md:items-center md:gap-2.5">
          <Image
            src="/icon.png"
            alt="Rapid Cortex"
            width={32}
            height={32}
            className="h-8 w-8 shrink-0 rounded-md ring-1 ring-white/10"
            priority
          />
          <span className="text-sm font-semibold tracking-tight text-white">Rapid Cortex</span>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
          {user ? <SidebarHomeButton user={user} onNavigate={onNavigate} /> : null}
          {tabs.map((tab) => {
            const href = resolveNavHref(tab);
            const pathForActive = href.includes("#") ? href.slice(0, href.indexOf("#")) : href;
            const active = navItemIsActive(pathname, pathForActive);
            const Icon = sidebarIconForTab(tab.id);
            return (
              <Link
                key={tab.id}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors ${
                  active
                    ? "bg-slate-900/90 text-white"
                    : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
                }`}
                style={
                  active
                    ? {
                        borderLeft: "3px solid var(--role-accent)",
                        paddingLeft: "calc(0.5rem - 3px)",
                        backgroundColor: "color-mix(in srgb, var(--role-accent-dim) 55%, rgb(2 6 23))",
                        boxShadow: `inset 0 0 0 1px color-mix(in srgb, var(--role-accent) 20%, transparent)`,
                      }
                    : { borderLeft: "3px solid transparent" }
                }
                onClick={onNavigate}
              >
                <Icon
                  className="h-4 w-4 shrink-0 opacity-90"
                  style={{ color: active ? "var(--role-accent)" : "rgb(148 163 184)" }}
                  aria-hidden
                />
                <span className="min-w-0 leading-snug">{tab.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto shrink-0">
          {user ? <SidebarSignOutFooter email={user.email} /> : null}
          <p className="px-3 pb-2 text-[10px] leading-relaxed text-slate-600">
            CJIS-aligned controls and audit-ready logs.
          </p>
        </div>
      </div>
    </aside>
  );
}
