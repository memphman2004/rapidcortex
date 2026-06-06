import type { SystemStatus } from "@/lib/rapid-cortex/status/status-types";
import { STATUS_LABELS } from "@/components/status/status-ui-copy";

const DOT_CLASS: Record<SystemStatus, string> = {
  operational: "bg-emerald-400",
  degraded: "bg-amber-400",
  partial_outage: "bg-orange-400",
  major_outage: "bg-rose-500",
  maintenance: "bg-sky-400",
};

const PILL_CLASS: Record<SystemStatus, string> = {
  operational:
    "border-emerald-500/35 bg-emerald-500/15 text-emerald-100 ring-emerald-500/25",
  degraded: "border-amber-500/35 bg-amber-500/15 text-amber-100 ring-amber-500/20",
  partial_outage: "border-orange-500/35 bg-orange-500/15 text-orange-100 ring-orange-500/20",
  major_outage: "border-rose-500/40 bg-rose-500/15 text-rose-100 ring-rose-500/20",
  maintenance: "border-sky-500/35 bg-sky-500/15 text-sky-100 ring-sky-500/20",
};

type StatusBadgeProps = {
  status: SystemStatus;
  variant: "pill-sm" | "pill-md" | "dot-text";
  className?: string;
};

export function StatusBadge({ status, variant, className }: StatusBadgeProps) {
  const label = STATUS_LABELS[status];

  if (variant === "dot-text") {
    return (
      <span
        className={[
          "inline-flex items-center gap-1.5 text-xs font-medium text-slate-200",
          className ?? "",
        ].join(" ")}
      >
        <span
          className={[`h-1.5 w-1.5 shrink-0 rounded-full ring-2 ring-black/40`, DOT_CLASS[status]].join(
            " ",
          )}
          aria-hidden
        />
        {label}
      </span>
    );
  }

  const sizing =
    variant === "pill-md"
      ? "px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide"
      : "px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide";

  return (
    <span
      className={[
        "inline-flex shrink-0 items-center rounded-full border ring-1",
        sizing,
        PILL_CLASS[status],
        className ?? "",
      ].join(" ")}
    >
      {label}
    </span>
  );
}
