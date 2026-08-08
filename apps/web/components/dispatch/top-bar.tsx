"use client";

import Link from "next/link";
import { SiteLogoMark } from "@/components/brand/site-logo-link";
import type { UserContext } from "rapid-cortex-shared";
import { useSession } from "@/components/auth/session-context";
import { isApiConfigured } from "@/lib/api";
import { trainingModeCompactDetail } from "@/lib/training-mode";
import { isAuthConfigured } from "@/lib/auth/roles";
import { EnvironmentBadge } from "@/components/dispatch/environment-badge";
import { FontPicker } from "@/components/ui/font-picker";
import { UserIdentityBar } from "@/components/ui/user-identity-bar";
import { HelpButton } from "@/components/help/help-button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { getRoleHeaderBadgeLabel } from "@/lib/dashboards/role-header-badge";
import { resolvePsapRole } from "@/lib/dashboards/psap-role-nav";
import { useJurisdictionLink } from "@/lib/jurisdiction-context";

export function TopBar({ user: serverUser }: { user?: UserContext | null }) {
  const to = useJurisdictionLink();
  const { user: sessionUser, isLoading } = useSession();
  const user = serverUser ?? sessionUser;
  const apiLive = isApiConfigured();
  const authOn = isAuthConfigured();

  const agencyLabel =
    user?.agencyId ?? (authOn && isLoading ? "…" : authOn ? "—" : "Configure auth");
  const roleBadge = user ? getRoleHeaderBadgeLabel(user.role) : null;
  const psapRole = user ? resolvePsapRole(user.role) : "";

  return (
    <header
      className="rc-sticky-toolbar flex h-36 shrink-0 items-center justify-between border-b-0 px-3 sm:h-40 sm:px-4 lg:px-6 2xl:px-8"
      style={{
        background: "var(--rc-surface)",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      <div className="flex min-w-0 items-center gap-2 sm:gap-3 lg:gap-4">
        <Link href={to("/dashboard")} className="flex shrink-0 items-center gap-2">
          <SiteLogoMark heightClass="h-24 sm:h-28" priority />
        </Link>
        <div className="hidden h-6 w-px bg-slate-700 sm:block" aria-hidden />
        <div className="hidden min-w-0 flex-col sm:flex">
          <span className="text-[10px] font-medium uppercase leading-none tracking-wider text-slate-500">
            Agency
          </span>
          <span className="truncate text-sm text-slate-200 lg:text-[15px]">{agencyLabel}</span>
        </div>
        <div className="hidden items-center gap-2 md:flex">
          <EnvironmentBadge />
          {roleBadge ? (
            <span
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                psapRole === "dispatcher"
                  ? "ring-1"
                  : "bg-slate-900 text-slate-300 ring-1 ring-slate-700"
              }`}
              style={
                psapRole === "dispatcher"
                  ? {
                      background: "rgba(59,130,246,0.15)",
                      color: "#93c5fd",
                      boxShadow: "inset 0 0 0 1px rgba(59,130,246,0.45)",
                    }
                  : undefined
              }
            >
              {roleBadge}
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:gap-3 lg:gap-4">
        <HelpButton />
        <ThemeToggle variant="inline" />
        <FontPicker />
        <div
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            apiLive
              ? "bg-emerald-950 text-emerald-400 ring-1 ring-emerald-800"
              : "bg-amber-950 text-amber-300 ring-1 ring-amber-800"
          }`}
          title={apiLive ? "Connected" : trainingModeCompactDetail()}
        >
          {apiLive ? "Connected" : "Training"}
        </div>
        {user ? (
          <UserIdentityBar email={user.email} role={user.role} agencyId={user.agencyId} userId={user.userId} />
        ) : null}
      </div>
    </header>
  );
}
