"use client";

import type { ReactNode } from "react";

type Health = "ok" | "warn" | "err" | "unknown";

const dot: Record<Health, string> = {
  ok: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]",
  warn: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.4)]",
  err: "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.45)]",
  unknown: "bg-slate-500",
};

export function ProviderHealthCard({
  title,
  health,
  children,
  footer,
}: {
  title: string;
  health: Health;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex flex-col rounded-lg border border-slate-800 bg-slate-900/40 p-3">
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dot[health]}`} aria-hidden />
        <h3 className="text-sm font-medium text-slate-100">{title}</h3>
      </div>
      <div className="mt-2 text-xs leading-relaxed text-slate-400">{children}</div>
      {footer ? <div className="mt-2 border-t border-slate-800/80 pt-2 text-[11px] text-slate-500">{footer}</div> : null}
    </div>
  );
}
