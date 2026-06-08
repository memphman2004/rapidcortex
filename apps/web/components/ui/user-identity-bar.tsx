"use client";

import { useState } from "react";
import { isRapidCortexRole, migrateLegacyRapidCortexRoleTokenValue, ROLE_LABELS } from "rapid-cortex-shared/auth/rapid-cortex-roles";
import { signOutFromClient } from "@/lib/auth/sign-out-client";
import { getRoleDashboardIdentity } from "@/lib/dashboards/role-dashboard-design";
import { getRoleHeaderBadgeLabel } from "@/lib/dashboards/role-header-badge";

export interface UserIdentityBarProps {
  email: string;
  role: string;
  agencyId?: string;
  roleLabel?: string;
}

export function UserIdentityBar({ email, role, roleLabel }: UserIdentityBarProps) {
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    await signOutFromClient();
  }

  const effective = migrateLegacyRapidCortexRoleTokenValue(role.trim()) ?? role.trim();
  const displayRole =
    roleLabel ??
    (isRapidCortexRole(effective) ? ROLE_LABELS[effective] : ROLE_LABELS[effective] ?? effective);
  const displayName = email.split("@")[0] ?? email;
  const palette = getRoleDashboardIdentity("rc-admin", effective);
  const headerBadge = getRoleHeaderBadgeLabel(effective);

  return (
    <div className="flex items-center gap-3">
      <div
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold uppercase"
        style={{
          backgroundColor: "color-mix(in srgb, var(--role-badge-bg) 55%, rgb(2 6 23))",
          color: "var(--role-text-accent)",
        }}
      >
        {displayName.slice(0, 2)}
      </div>

      <div className="hidden min-w-0 flex-col sm:flex">
        <span className="max-w-[160px] truncate text-[11px] font-semibold text-slate-200">{email}</span>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wide text-slate-500">{displayRole}</span>
          {headerBadge ? (
            <span
              className="rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest"
              style={{
                borderColor: `color-mix(in srgb, ${palette.badgeBg} 70%, transparent)`,
                backgroundColor: `color-mix(in srgb, ${palette.badgeBg} 35%, rgb(2 6 23))`,
                color: palette.textColor,
              }}
            >
              {headerBadge}
            </span>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        onClick={() => void handleSignOut()}
        disabled={signingOut}
        className="rounded border border-slate-700/60 bg-slate-800/60 px-2.5 py-1 text-[11px] font-medium text-slate-400 transition-colors hover:border-slate-600 hover:text-slate-200 disabled:opacity-50"
      >
        {signingOut ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}
