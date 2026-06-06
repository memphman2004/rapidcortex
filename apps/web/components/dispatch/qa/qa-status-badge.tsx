import type { QASessionStatus } from "rapid-cortex-shared";

const styles: Record<QASessionStatus, string> = {
  draft: "bg-slate-800 text-slate-200 ring-slate-600",
  scoring: "bg-amber-950 text-amber-200 ring-amber-800",
  scored: "bg-sky-950 text-sky-200 ring-sky-800",
  reviewed: "bg-emerald-950 text-emerald-200 ring-emerald-800",
  failed: "bg-rose-950 text-rose-200 ring-rose-800",
};

export function QaStatusBadge({ status }: { status: QASessionStatus }) {
  return (
    <span
      className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${styles[status]}`}
    >
      {status.replace("_", " ")}
    </span>
  );
}
