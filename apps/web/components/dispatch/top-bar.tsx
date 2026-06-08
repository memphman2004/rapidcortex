"use client";

import Link from "next/link";
import { SiteLogoMark } from "@/components/brand/site-logo-link";
import type { UserContext } from "rapid-cortex-shared";
import { useSession } from "@/components/auth/session-context";
import { isApiConfigured } from "@/lib/api";
import { trainingModeCompactDetail } from "@/lib/training-mode";
import { isAuthConfigured } from "@/lib/auth/roles";
import { hasSubscriberManualAccess } from "@/lib/auth/subscriber-access";
import { EnvironmentBadge } from "@/components/dispatch/environment-badge";
import { FontPicker } from "@/components/ui/font-picker";
import { UserIdentityBar } from "@/components/ui/user-identity-bar";
import { getRoleHeaderBadgeLabel } from "@/lib/dashboards/role-header-badge";
import { resolvePsapRole } from "@/lib/dashboards/psap-role-nav";
import { useJurisdictionLink } from "@/lib/jurisdiction-context";
import { marketingCompleteManualPath } from "@/lib/marketing-links";

export function TopBar({ user: serverUser }: { user?: UserContext | null }) {
  const to = useJurisdictionLink();
  const { user: sessionUser, isLoading } = useSession();
  const user = serverUser ?? sessionUser;
  const apiLive = isApiConfigured();
  const authOn = isAuthConfigured();
  const useProxy = typeof process !== "undefined" && process.env.NEXT_PUBLIC_AUTH_PROXY === "1";

  const agencyLabel =
    user?.agencyId ?? (authOn && isLoading ? "…" : authOn ? "—" : "Configure auth");
  const roleBadge = user ? getRoleHeaderBadgeLabel(user.role) : null;
  const psapRole = user ? resolvePsapRole(user.role) : "";

  return (
    <header className="rc-sticky-toolbar flex h-36 shrink-0 items-center justify-between border-b-0 bg-slate-950 px-3 sm:h-40 sm:px-4 lg:px-6 2xl:px-8">
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
                  ? "bg-sky-950 text-sky-300 ring-1 ring-sky-800"
                  : "bg-slate-900 text-slate-300 ring-1 ring-slate-700"
              }`}
            >
              {roleBadge}
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:gap-3 lg:gap-4">
        <FontPicker />
        {user && hasSubscriberManualAccess(user) ? (
          <Link
            href={marketingCompleteManualPath()}
            className="inline-flex shrink-0 rounded-md border border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-slate-900"
          >
            Manual
          </Link>
        ) : null}
        <div
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            apiLive
              ? "bg-emerald-950 text-emerald-400 ring-1 ring-emerald-800"
              : "bg-amber-950 text-amber-300 ring-1 ring-amber-800"
          }`}
          title={
            apiLive
              ? useProxy
                ? "Using authenticated proxy (/api/backend)"
                : "Using NEXT_PUBLIC_API_BASE"
              : `${trainingModeCompactDetail()} Optional local mock: NEXT_PUBLIC_OFFLINE_DEMO_MODE=1`
          }
        >
          {apiLive ? (useProxy ? "API (auth)" : "API") : "Training"}
        </div>
        {user ? (
          <UserIdentityBar email={user.email} role={user.role} agencyId={user.agencyId} />
        ) : null}
      </div>
    </header>
  );
}
