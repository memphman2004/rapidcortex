"use client";

import { Bell, Menu } from "lucide-react";
import type { UserContext } from "rapid-cortex-shared";
import type { RoleDashboardIdentity } from "@/lib/dashboards/role-dashboard-design";
import { FontPicker } from "@/components/ui/font-picker";
import { UserIdentityBar } from "@/components/ui/user-identity-bar";

export function TopNav({
  identity,
  user,
  onMenuClick,
}: {
  identity: RoleDashboardIdentity;
  user: UserContext;
  onMenuClick?: () => void;
}) {
  return (
    <header
      className="sticky top-0 z-30 flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-slate-800/90 bg-slate-950/95 px-4 py-2 backdrop-blur md:px-6"
      style={{ borderBottomColor: "color-mix(in srgb, var(--role-accent) 25%, rgb(30 41 59))" }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <button
          type="button"
          className="inline-flex shrink-0 rounded-md border border-slate-700 p-2 text-slate-200 md:hidden"
          aria-label="Open sidebar"
          onClick={onMenuClick}
        >
          <Menu className="h-4 w-4" />
        </button>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{identity.identityTitle}</p>
          <p className="truncate text-xs text-slate-500">{identity.identitySubtitle}</p>
        </div>
        <span
          className="hidden max-w-[240px] items-center gap-1.5 rounded border px-2 py-1 text-[10px] font-medium uppercase tracking-wide sm:inline-flex"
          style={{
            borderColor: "color-mix(in srgb, var(--role-accent) 45%, transparent)",
            backgroundColor: "color-mix(in srgb, var(--role-badge-bg) 35%, rgb(2 6 23))",
            color: "var(--role-text-accent)",
          }}
        >
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: "var(--role-accent)" }}
          />
          Operational
        </span>
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        <FontPicker />
        <button
          type="button"
          className="relative rounded-md border border-slate-700 p-2 text-slate-300 hover:bg-slate-800"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-slate-950" />
        </button>
        {user ? (
          <UserIdentityBar email={user.email} role={user.role} agencyId={user.agencyId} />
        ) : null}
      </div>
    </header>
  );
}
