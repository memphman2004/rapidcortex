import type { IncidentStatus } from "../_lib/venue-types";

const stylesByStatus: Record<IncidentStatus, string> = {
  open: "border border-red-500/30 bg-red-500/15 text-red-400",
  assigned: "border border-amber-500/30 bg-amber-500/15 text-amber-400",
  responding: "border border-sky-500/30 bg-sky-500/15 text-sky-400",
  resolved: "border border-green-500/30 bg-green-500/15 text-green-400",
  escalated: "border border-violet-500/30 bg-violet-500/15 text-violet-400",
};

export function IncidentStatusBadge({ status, className }: { status: IncidentStatus; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${stylesByStatus[status]} ${className ?? ""}`}
    >
      {status}
    </span>
  );
}
