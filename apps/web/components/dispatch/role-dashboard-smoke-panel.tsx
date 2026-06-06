"use client";

import { useSession } from "@/components/auth/session-context";
import { formatUserRoleLabel } from "@/lib/auth/roles";

type Props = {
  /** Shown in the card title, e.g. "RC Admin". */
  title: string;
  /** Jurisdiction path for this smoke test, e.g. /rc-admin */
  pathLabel: string;
};

/**
 * Test harness strip for role-based accounts — shows live session fields.
 */
export function RoleDashboardSmokePanel({ title, pathLabel }: Props) {
  const { user } = useSession();
  if (!user) {
    return (
      <div className="mb-6 rounded-lg border border-amber-800/50 bg-amber-950/30 p-4 text-sm text-amber-100">
        <p className="font-semibold">Session</p>
        <p className="mt-1 text-amber-200/80">Not signed in.</p>
      </div>
    );
  }
  return (
    <div className="mb-6 rounded-lg border border-emerald-800/50 bg-emerald-950/25 p-4 text-sm text-slate-200">
      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-400/90">
        Role test · {title}
      </p>
      <p className="mt-2 text-base font-medium text-white">
        Dashboard connected successfully
      </p>
      <dl className="mt-3 grid gap-1 font-mono text-xs text-slate-400 sm:grid-cols-2">
        <div>
          <dt className="text-slate-500">Route</dt>
          <dd className="text-slate-200">{pathLabel}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Email</dt>
          <dd className="text-slate-200">{user.email || "—"}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Role</dt>
          <dd className="text-slate-200">
            {user.role} ({formatUserRoleLabel(user.role)})
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Agency</dt>
          <dd className="text-slate-200">{user.agencyId}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-slate-500">Status (Cognito custom:status / token)</dt>
          <dd className="text-slate-200">{user.accountStatus ?? "— (not in ID token or unset)"}</dd>
        </div>
      </dl>
    </div>
  );
}
