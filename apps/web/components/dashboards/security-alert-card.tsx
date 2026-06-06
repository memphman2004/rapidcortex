import type { SecurityAlert } from "@/lib/dashboards/mockDashboardData";
import { StatusBadge } from "./status-badge";

export function SecurityAlertCard({ alert }: { alert: SecurityAlert }) {
  return (
    <div className="rounded-lg border border-red-900/30 bg-red-950/20 p-4 ring-1 ring-red-500/10">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-red-100">{alert.title}</h3>
        <StatusBadge tone={alert.severity} />
      </div>
      <p className="mt-2 text-xs text-red-200/80">{alert.message}</p>
      <p className="mt-2 font-mono text-[10px] text-slate-500">agency: {alert.agencyId}</p>
    </div>
  );
}
