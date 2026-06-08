"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, type CSSProperties } from "react";
import { usePathname } from "next/navigation";
import type { UserContext } from "rapid-cortex-shared/types";
import { buildNavContext } from "@/lib/navigation/nav-context";
import { filterRoleNavByFeatures } from "@/lib/navigation/filter-role-nav";
import { navIconByName } from "@/lib/navigation/nav-icons";
import { getRoleNav, type NavBadge, type NavItem, type RoleNav } from "@/lib/navigation/role-nav";
import { useNavBadgeCounts, type NavBadgeCounts } from "@/lib/navigation/use-nav-badge-counts";
import { SidebarHomeButton } from "@/components/ui/sidebar-home-button";
import { SidebarSignOutFooter } from "@/components/ui/sidebar-sign-out-footer";
import { useOptionalJurisdictionSlug } from "@/lib/jurisdiction-context";
import { defaultJurisdictionSlug } from "@/lib/marketing-links";

const ACCENT_STYLES: Record<
  RoleNav["accent"],
  { accent: string; dim: string; text: string }
> = {
  violet: { accent: "#C084FC", dim: "#3B1157", text: "#F3E8FF" },
  sky: { accent: "#0284C7", dim: "#0C4A6E", text: "#E0F2FE" },
  orange: { accent: "#F97316", dim: "#7C2D12", text: "#FFEDD5" },
  teal: { accent: "#14B8A6", dim: "#134E4A", text: "#CCFBF1" },
  slate: { accent: "#94A3B8", dim: "#1E293B", text: "#E2E8F0" },
  rose: { accent: "#F43F5E", dim: "#881337", text: "#FFE4E6" },
};

const LABEL_BADGE_CLASS: Record<"red" | "yellow" | "blue" | "slate", string> = {
  red: "bg-rose-950/80 text-rose-300 ring-rose-800/60",
  yellow: "bg-amber-950/80 text-amber-300 ring-amber-800/60",
  blue: "bg-sky-950/80 text-sky-300 ring-sky-800/60",
  slate: "bg-slate-800/80 text-slate-400 ring-slate-700/60",
};

function navItemIsActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href || pathname === `${item.href}/`;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function NavItemBadge({
  badge,
  counts,
}: {
  badge: NavBadge;
  counts: NavBadgeCounts;
}) {
  if (badge.type === "label") {
    return (
      <span
        className={`ml-auto shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ring-1 ${LABEL_BADGE_CLASS[badge.color]}`}
      >
        {badge.text}
      </span>
    );
  }
  if (badge.type === "count") {
    const n = counts[badge.key] ?? 0;
    if (n <= 0) return null;
    return (
      <span className="ml-auto shrink-0 rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
        {n > 99 ? "99+" : n}
      </span>
    );
  }
  return (
    <span
      className="ml-auto h-2 w-2 shrink-0 rounded-full"
      style={{ backgroundColor: badge.color === "green" ? "#22c55e" : badge.color === "yellow" ? "#eab308" : "#ef4444" }}
      aria-hidden
    />
  );
}

export function RoleNavSections({
  nav,
  counts,
  variant = "sidebar",
  onNavigate,
}: {
  nav: RoleNav;
  counts?: NavBadgeCounts;
  variant?: "sidebar" | "compact";
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const badgeCounts = counts ?? {};

  return (
    <div className={variant === "compact" ? "space-y-3" : "space-y-4"}>
      {nav.sections.map((section) => (
        <div key={section.id}>
          {section.label ? (
            <p
              className={
                variant === "compact"
                  ? "mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500"
                  : "mb-1 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500"
              }
            >
              {section.label}
            </p>
          ) : null}
          <ul className={variant === "compact" ? "flex flex-wrap gap-2" : "flex flex-col gap-0.5"}>
            {section.items.map((item) => {
              const Icon = navIconByName(item.icon);
              const active = navItemIsActive(pathname, item);
              const linkClass =
                variant === "compact"
                  ? `block rounded-md border px-3 py-2 text-sm font-semibold transition-colors ${
                      active
                        ? "border-orange-500/40 bg-slate-800 text-white"
                        : "border-slate-700 bg-slate-900/70 text-slate-200 hover:border-slate-600 hover:bg-slate-800"
                    }`
                  : `flex items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors ${
                      active
                        ? "bg-slate-900/90 text-white"
                        : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
                    }`;

              return (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={linkClass}
                    style={
                      variant === "sidebar" && active
                        ? {
                            borderLeft: "3px solid var(--role-accent)",
                            paddingLeft: "calc(0.5rem - 3px)",
                            backgroundColor:
                              "color-mix(in srgb, var(--role-accent-dim) 55%, rgb(2 6 23))",
                            boxShadow:
                              "inset 0 0 0 1px color-mix(in srgb, var(--role-accent) 20%, transparent)",
                          }
                        : variant === "sidebar"
                          ? { borderLeft: "3px solid transparent" }
                          : undefined
                    }
                    onClick={onNavigate}
                    {...(item.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  >
                    {variant === "sidebar" ? (
                      <Icon
                        className="h-4 w-4 shrink-0 opacity-90"
                        style={{ color: active ? "var(--role-accent)" : "rgb(148 163 184)" }}
                        aria-hidden
                      />
                    ) : null}
                    <span className="min-w-0 leading-snug">{item.label}</span>
                    {item.badge ? <NavItemBadge badge={item.badge} counts={badgeCounts} /> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function RoleNavSidebar({
  user,
  mobileOpen,
  onNavigate,
  showChrome = true,
}: {
  user: UserContext;
  mobileOpen?: boolean;
  onNavigate?: () => void;
  /** Full dashboard shell chrome (logo, home, sign-out). Set false for embedded vertical nav. */
  showChrome?: boolean;
}) {
  const jurisdictionSlug = useOptionalJurisdictionSlug() ?? defaultJurisdictionSlug();
  const counts = useNavBadgeCounts(user.role);
  const nav = useMemo(() => {
    const ctx = buildNavContext(user, jurisdictionSlug);
    return filterRoleNavByFeatures(getRoleNav(user.role, ctx));
  }, [user, jurisdictionSlug]);

  const palette = ACCENT_STYLES[nav.accent];
  const shellVars = {
    "--role-accent": palette.accent,
    "--role-accent-dim": palette.dim,
    "--role-text-accent": palette.text,
  } as CSSProperties;

  const inner = (
    <>
      {showChrome ? (
        <div className="mb-5 hidden px-1 md:flex md:items-center md:gap-2.5">
          <Image
            src="/icon.png"
            alt="Rapid Cortex"
            width={32}
            height={32}
            className="h-8 w-8 shrink-0 rounded-md ring-1 ring-white/10"
            priority
          />
          <div className="min-w-0">
            <span className="block text-sm font-semibold tracking-tight text-white">Rapid Cortex</span>
            <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
              {nav.roleBadge}
            </span>
          </div>
        </div>
      ) : null}
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
        {showChrome ? <SidebarHomeButton user={user} onNavigate={onNavigate} /> : null}
        <RoleNavSections nav={nav} counts={counts} onNavigate={onNavigate} />
      </nav>
      {showChrome ? (
        <div className="mt-auto shrink-0">
          <SidebarSignOutFooter email={user.email} />
          <p className="px-3 pb-2 text-[10px] leading-relaxed text-slate-600">
            CJIS-aligned controls and audit-ready logs.
          </p>
        </div>
      ) : null}
    </>
  );

  if (!showChrome) {
    return (
      <div style={shellVars} className="w-full">
        {inner}
      </div>
    );
  }

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 w-60 transform border-r border-slate-800/90 bg-[#050b14] pt-14 transition-transform md:static md:z-0 md:translate-x-0 md:pt-0 ${
        mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      }`}
      style={{
        ...shellVars,
        borderRightColor: "color-mix(in srgb, var(--role-accent) 22%, rgb(30 41 59))",
        borderTop: "3px solid var(--role-accent)",
      }}
    >
      <div className="flex h-full flex-col px-3 py-4">{inner}</div>
    </aside>
  );
}
