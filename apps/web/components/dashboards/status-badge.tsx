import type { StatusTone } from "@/lib/dashboards/mockDashboardData";

const toneStyles: Record<StatusTone, string> = {
  active: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
  critical: "border-red-500/50 bg-red-500/15 text-red-200",
  warning: "border-amber-500/40 bg-amber-500/10 text-amber-100",
  resolved: "border-slate-500/40 bg-slate-500/10 text-slate-200",
  pending: "border-sky-500/40 bg-sky-500/10 text-sky-100",
  offline: "border-zinc-600 bg-zinc-800/80 text-zinc-400",
  manual_mode: "border-indigo-500/40 bg-indigo-500/10 text-indigo-100",
  ai_suggested: "border-cyan-500/40 bg-cyan-500/10 text-cyan-100",
  supervisor_watching: "border-violet-500/40 bg-violet-500/10 text-violet-100",
};

const labels: Record<StatusTone, string> = {
  active: "Active",
  critical: "Critical",
  warning: "Warning",
  resolved: "Resolved",
  pending: "Pending",
  offline: "Offline",
  manual_mode: "Manual Mode",
  ai_suggested: "AI Suggested",
  supervisor_watching: "Supervisor Watching",
};

export function StatusBadge({ tone }: { tone: StatusTone }) {
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium uppercase tracking-wide ${toneStyles[tone]}`}
    >
      {labels[tone]}
    </span>
  );
}
