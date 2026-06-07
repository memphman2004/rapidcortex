"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WellnessNavBadge } from "@/components/admin/wellness-nav-badge";
import { useSession } from "@/components/auth/session-context";
import { SidebarHomeButton } from "@/components/ui/sidebar-home-button";
import { useJurisdictionLink } from "@/lib/jurisdiction-context";
import { isRcInternalOperator } from "rapid-cortex-shared/tenancy/principal";
import { RC_PLATFORM_COMMAND_PATHS } from "@/lib/platform-command-nav";
import {
  isDeceptionShieldUiEnabled,
  isDispatcherWellnessUiEnabled,
  isNonEmergencyTriageEnabled,
  isQaScoringEnabled,
  isSeoIntelligenceUiEnabled,
  isSopProtocolEnabled,
} from "@/lib/runtime-flags";

const tabs = [
  { path: "/admin", label: "Overview" },
  { path: "/admin/pilot", label: "IT setup" },
  { path: "/admin/configuration", label: "Configuration" },
  { path: "/admin/users", label: "Users" },
  { path: "/admin/audit", label: "Audit log" },
  { path: "/admin/billing", label: "Billing" },
  { path: "/admin/protocols", label: "Protocols" },
  { path: "/admin/protocols/sop", label: "SOP docs", feature: "sop" as const },
  { path: "/admin/qa/templates", label: "QA templates", feature: "qa" as const },
  { path: "/admin/triage/config", label: "Triage", feature: "triage" as const },
  { path: "/admin/wellness", label: "Wellness", feature: "wellness" as const },
  { path: "/admin/integrations", label: "Integrations" },
  { path: "/admin/settings", label: "Environment" },
  { path: "/admin/settings/downloads", label: "Downloads" },
  { path: "/admin/seo", label: "SEO Intel", feature: "seoIntel" as const },
  {
    path: "/admin/security/deception-shield",
    label: "Deception Shield",
    feature: "deceptionShield" as const,
    rolesOnly: ["rcsuperadmin", "agencyit", "rcitadmin"] as const,
  },
] as const;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const to = useJurisdictionLink();
  const { user } = useSession();

  const visibleTabs = tabs.filter((t) => {
    if ("rolesOnly" in t) {
      if (!isDeceptionShieldUiEnabled()) return false;
      const r = user?.role ?? "";
      return (t.rolesOnly as readonly string[]).includes(r);
    }
    if (!("feature" in t)) return true;
    if (t.feature === "qa") return isQaScoringEnabled();
    if (t.feature === "sop") return isSopProtocolEnabled();
    if (t.feature === "triage") return isNonEmergencyTriageEnabled();
    if (t.feature === "wellness") return isDispatcherWellnessUiEnabled();
    if (t.feature === "seoIntel") return isSeoIntelligenceUiEnabled();
    if (t.feature === "deceptionShield") return isDeceptionShieldUiEnabled();
    return true;
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-slate-950/40">
      <nav
        className="rc-sticky-toolbar flex items-center gap-0.5 overflow-x-auto border-b-0 py-1.5 pl-2 pr-3 sm:pl-3 lg:gap-1 lg:pl-4 lg:pr-4 2xl:px-6"
        aria-label="Agency admin sections"
      >
        {user ? (
          <div className="mr-1 shrink-0">
            <SidebarHomeButton user={user} className="!mb-0 border-0 bg-transparent px-2 py-1.5 text-[12px] font-medium text-slate-300 hover:bg-slate-900 hover:text-white" />
          </div>
        ) : null}
        {visibleTabs.map(({ path, label }) => {
          const href = to(path);
          const active =
            path === "/admin"
              ? pathname === href
              : path === "/admin/billing"
                ? pathname.startsWith(to("/admin/billing"))
                : path === "/admin/qa/templates"
                  ? pathname.startsWith(to("/admin/qa"))
                  : path === "/admin/protocols"
                    ? pathname === href
                    : path === "/admin/settings"
                      ? pathname === href
                      : path === "/admin/seo"
                        ? pathname === href || pathname.startsWith(`${href}/`)
                        : path === "/admin/security/deception-shield"
                          ? pathname === href || pathname.startsWith(`${href}/`)
                          : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={path}
              href={href}
              className={`shrink-0 rounded-md px-2.5 py-1.5 text-[12px] font-medium leading-tight sm:px-3 sm:text-[13px] ${
                active
                  ? "bg-slate-800 text-sky-300"
                  : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
              }`}
            >
              {label}
            </Link>
          );
        })}
        {user && isRcInternalOperator(user.role) ? (
          <Link
            href={RC_PLATFORM_COMMAND_PATHS.dashboard}
            className={`shrink-0 rounded-md px-2.5 py-1.5 text-[12px] font-medium sm:px-3 sm:text-[13px] ${
              pathname.startsWith("/rc-admin") || pathname.startsWith(to("/admin/platform"))
                ? "bg-rose-950/60 text-rose-100 ring-1 ring-rose-500/30"
                : "text-rose-200/80 hover:bg-rose-950/40 hover:text-rose-50"
            }`}
          >
            Platform
          </Link>
        ) : null}
        <div className="shrink-0 pl-0.5">
          <WellnessNavBadge />
        </div>
      </nav>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">{children}</div>
    </div>
  );
}
