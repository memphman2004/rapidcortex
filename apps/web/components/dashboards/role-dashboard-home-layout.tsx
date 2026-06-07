"use client";

import { usePathname } from "next/navigation";
import type { DashboardPrefix } from "@/lib/dashboards/dashboard-access";
import { getRoleDashboardIdentity } from "@/lib/dashboards/role-dashboard-design";
import { RcAdminHomePanels } from "./rc-admin-live-dashboard";

function isRoleDashboardHome(pathname: string, prefix: DashboardPrefix): boolean {
  const base = `/${prefix}/dashboard`;
  return pathname === base || pathname === `${base}/`;
}

function QueuePlaceholder({ accent }: { accent: string }) {
  const rows = ["CAD-4412 · Priority", "CAD-4410 · Routine", "CAD-4408 · Hold", "CAD-4401 · Cleared"];
  return (
    <div className="flex h-full min-h-[280px] flex-col rounded-lg border border-slate-800 bg-slate-950/80 p-3">
      <h3 className="mb-2 border-b border-slate-800 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Queue
      </h3>
      <ul className="space-y-2 text-xs">
        {rows.map((r) => (
          <li
            key={r}
            className="rounded border border-slate-800/90 px-2 py-2 font-mono text-slate-300"
            style={{ borderLeftWidth: 3, borderLeftColor: accent }}
          >
            {r}
          </li>
        ))}
      </ul>
    </div>
  );
}

function HeatmapPlaceholder() {
  return (
    <div className="rounded-lg border border-dashed border-slate-700 bg-slate-950/50 p-4">
      <p className="text-xs font-medium text-slate-400">Incident heatmap</p>
      <div className="mt-3 grid grid-cols-6 gap-1">
        {Array.from({ length: 24 }).map((_, i) => (
          <div
            key={i}
            className="aspect-square rounded-sm bg-slate-800"
            style={{ opacity: 0.25 + (i % 5) * 0.12 }}
          />
        ))}
      </div>
    </div>
  );
}

/** Extra home chrome for live-ops roles only. Admin/QA/executive content lives in DashboardPageContent. */
export function RoleDashboardHomeLayout({
  prefix,
  children,
}: {
  prefix: DashboardPrefix;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const id = getRoleDashboardIdentity(prefix);
  const home = isRoleDashboardHome(pathname, prefix);

  if (!home) {
    return <div className="min-h-0 flex-1">{children}</div>;
  }

  if (prefix === "dispatcher") {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
        <div className="min-h-0 min-w-0 flex-1 space-y-3 rounded-lg border border-slate-800/90 bg-slate-950/40 p-4 ring-1 ring-black/20">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Active call
            </span>
            <span
              className="h-2 w-2 rounded-full"
              style={{
                backgroundColor: id.accent,
                boxShadow: `0 0 12px ${id.accentGlow}`,
              }}
            />
          </div>
          {children}
        </div>
        <div className="w-full shrink-0 lg:w-72">
          <QueuePlaceholder accent={id.accent} />
        </div>
      </div>
    );
  }

  if (prefix === "supervisor") {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          {["Team Alpha", "Team Bravo", "Team Charlie"].map((t) => (
            <div
              key={t}
              className="rounded-lg border border-slate-800 bg-slate-950/50 p-3"
              style={{ borderTopColor: id.accent, borderTopWidth: 3 }}
            >
              <p className="text-xs font-semibold text-white">{t}</p>
              <p className="mt-1 text-[11px] text-slate-500">Status cards · placeholder</p>
            </div>
          ))}
        </div>
        <HeatmapPlaceholder />
        <div>{children}</div>
      </div>
    );
  }

  if (prefix === "rc-admin") {
    return (
      <div className="space-y-4">
        <RcAdminHomePanels />
        <div>{children}</div>
      </div>
    );
  }

  return <div className="min-h-0 flex-1">{children}</div>;
}
