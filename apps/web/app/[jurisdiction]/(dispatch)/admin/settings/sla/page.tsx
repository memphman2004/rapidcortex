"use client";

import Link from "next/link";
import { SlaSupervisorPanel } from "@/components/dashboards/sla-supervisor-panel";
import { useSession } from "@/components/auth/session-context";
import { isSlaBacklogEnabled } from "@/lib/runtime-flags";
import { useJurisdictionLink } from "@/lib/jurisdiction-context";

function isSlaAdmin(role: string | undefined): boolean {
  return role === "agencyadmin" || role === "agencyit" || role === "rcsuperadmin";
}

export default function AdminSlaSettingsPage() {
  const { user } = useSession();
  const to = useJurisdictionLink();

  if (!user) return null;

  if (!isSlaAdmin(user.role)) {
    return (
      <div className="p-6">
        <p className="text-sm text-rose-300">You do not have permission to configure SLA thresholds.</p>
      </div>
    );
  }

  if (!isSlaBacklogEnabled()) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <h1 className="text-lg font-semibold text-white">SLA thresholds</h1>
        <p className="max-w-xl text-sm text-slate-400">
          SLA backlog tracking is disabled for this environment. Set{" "}
          <code className="text-violet-300">NEXT_PUBLIC_ENABLE_SLA_BACKLOG=1</code> to enable
          queue SLA metrics and threshold configuration.
        </p>
        <Link href={to("/admin/settings")} className="text-sm text-sky-400 hover:underline">
          ← Back to settings
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-400/90">Configuration</p>
        <h1 className="text-lg font-semibold text-white">SLA thresholds</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">
          Answer and dispatch SLA targets by priority. Changes apply agency-wide and are audited.
          Requires <code className="text-slate-500">reports.sla_config</code> permission.
        </p>
        <p className="mt-2 text-sm">
          <Link href={to("/admin/settings")} className="text-sky-400 hover:underline">
            ← Environment & compliance settings
          </Link>
        </p>
      </div>
      <SlaSupervisorPanel />
    </div>
  );
}
