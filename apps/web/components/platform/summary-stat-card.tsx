"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  trend?: ReactNode;
  variant?: "default" | "alert" | "ok";
};

export function SummaryStatCard({ label, value, hint, icon: Icon, trend, variant = "default" }: Props) {
  const border =
    variant === "alert"
      ? "border-rose-500/25 bg-rose-950/20"
      : variant === "ok"
        ? "border-emerald-500/20 bg-emerald-950/15"
        : "border-slate-700/80 bg-slate-900/50";
  return (
    <div className={`rounded-lg border p-3 shadow-sm ${border}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">{label}</p>
          <p className="mt-0.5 text-2xl font-semibold tabular-nums text-white">{value}</p>
          {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
        </div>
        <div className="rounded-md border border-slate-800 bg-slate-950/50 p-1.5 text-slate-300">
          <Icon className="h-4 w-4" aria-hidden />
        </div>
      </div>
      {trend ? <div className="mt-2 border-t border-slate-800/80 pt-2">{trend}</div> : null}
    </div>
  );
}
