import type { IncidentCategory, IncidentStatus, UrgencyLevel } from "rapid-cortex-shared";

const categoryStyles: Record<IncidentCategory, string> = {
  medical: "bg-sky-950 text-sky-300 ring-sky-800",
  fire: "bg-orange-950 text-orange-300 ring-orange-800",
  police: "bg-indigo-950 text-indigo-200 ring-indigo-800",
  welfare_check: "bg-teal-950 text-teal-200 ring-teal-800",
  domestic_disturbance: "bg-violet-950 text-violet-200 ring-violet-800",
  unknown: "bg-slate-800 text-slate-300 ring-slate-600",
};

const urgencyStyles: Record<UrgencyLevel, string> = {
  critical: "bg-red-950 text-red-300 ring-red-800",
  high: "bg-amber-950 text-amber-200 ring-amber-800",
  moderate: "bg-yellow-950 text-yellow-200 ring-yellow-900",
  low: "bg-emerald-950 text-emerald-200 ring-emerald-800",
};

const statusStyles: Record<IncidentStatus, string> = {
  active: "bg-slate-800 text-slate-200 ring-slate-600",
  in_progress: "bg-blue-950 text-blue-200 ring-blue-800",
  completed: "bg-slate-900 text-slate-400 ring-slate-700",
  archived: "bg-slate-900 text-slate-500 ring-slate-800",
};

export function CategoryBadge({ value }: { value: IncidentCategory }) {
  return (
    <span
      className={`inline-flex max-w-full truncate rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${categoryStyles[value]}`}
    >
      {value.replaceAll("_", " ")}
    </span>
  );
}

export function UrgencyBadge({ value }: { value: UrgencyLevel }) {
  return (
    <span
      className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${urgencyStyles[value]}`}
    >
      {value}
    </span>
  );
}

export function StatusBadge({ value }: { value: IncidentStatus }) {
  return (
    <span
      className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${statusStyles[value]}`}
    >
      {value.replaceAll("_", " ")}
    </span>
  );
}
