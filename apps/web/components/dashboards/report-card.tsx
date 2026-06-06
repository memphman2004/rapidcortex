import type { ReportRow } from "@/lib/dashboards/mockDashboardData";
import { StatusBadge } from "./status-badge";

export function ReportCard({ report }: { report: ReportRow }) {
  return (
    <div className="rounded-lg border border-slate-700/80 bg-slate-900/50 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-white">{report.title}</p>
          <p className="mt-1 text-xs text-slate-500">{report.period}</p>
        </div>
        <StatusBadge tone={report.status} />
      </div>
      <p className="mt-3 text-xs text-slate-500">
        {/* TODO: Link to signed report export after RBAC check. */}
        Open in reports module
      </p>
    </div>
  );
}
