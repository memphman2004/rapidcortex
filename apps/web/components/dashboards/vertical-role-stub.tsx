import type { CSSProperties } from "react";
import Link from "next/link";
import type { UserRole } from "rapid-cortex-shared/types";
import { ROLE_DISPLAY_LABELS } from "rapid-cortex-shared/auth/rapid-cortex-roles";
import { verticalFromRole } from "rapid-cortex-shared";
import { roleBandColor } from "@/lib/signal-colors";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { VerticalBadge } from "@/components/ui/VerticalBadge";
import type { Vertical } from "@/lib/vertical";

type Props = {
  consoleTitle: string;
  vertical: Vertical;
  role?: UserRole | string;
  description?: string;
};

export async function VerticalRoleStub({ consoleTitle, vertical, role, description }: Props) {
  const user = await getDashboardSessionUser();
  const effectiveRole = (role ?? user?.role ?? "dispatcher") as string;
  const accent = roleBandColor(effectiveRole);
  const roleLabel = ROLE_DISPLAY_LABELS[effectiveRole as UserRole] ?? effectiveRole;
  const verticalLabel = verticalFromRole(effectiveRole);
  const body =
    description ??
    "This dashboard is coming soon. The platform is live and your account is active.";

  return (
    <div
      className="min-h-screen bg-slate-950 text-slate-100"
      style={
        {
          "--role-accent": accent,
          "--role-accent-dim": `color-mix(in srgb, ${accent} 22%, rgb(2 6 23))`,
        } as CSSProperties
      }
    >
      <header
        className="border-b border-slate-800 px-6 py-4"
        style={{ borderTop: `4px solid ${accent}` }}
      >
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3">
          <VerticalBadge vertical={vertical} size="sm" />
          <span className="text-xs uppercase tracking-wide text-slate-400">{verticalLabel}</span>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight" style={{ color: accent }}>
          {consoleTitle}
        </h1>
        <p className="mt-2 text-sm text-slate-400">{roleLabel}</p>
        <p className="mt-8 rounded-lg border border-slate-800 bg-slate-900/60 px-5 py-4 text-slate-300">
          {body}
        </p>
        <p className="mt-8">
          <Link
            href="/api/auth/signout"
            className="text-sm font-medium text-sky-400 hover:text-sky-300 hover:underline"
          >
            Sign out
          </Link>
        </p>
      </main>
    </div>
  );
}
