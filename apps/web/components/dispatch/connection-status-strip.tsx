"use client";

import { getIntegrationStatusRows, type IntegrationHealth } from "@/lib/connection-status";

function dotClass(health: IntegrationHealth): string {
  switch (health) {
    case "live":
      return "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]";
    case "mock":
      return "bg-amber-400";
    case "offline":
      return "bg-slate-600";
    case "planned":
    default:
      return "bg-slate-500 opacity-70";
  }
}

export function ConnectionStatusStrip() {
  if (process.env.NODE_ENV !== "development") return null;
  const rows = getIntegrationStatusRows();
  return (
    <div
      className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-800 bg-slate-950/95 px-4 py-1.5 text-[11px] text-slate-400"
      aria-label="Integration and connection status"
    >
      <span className="font-semibold uppercase tracking-wider text-slate-500">Connections</span>
      {rows.map((row) => (
        <div key={row.id} className="flex items-center gap-1.5" title={row.detail}>
          <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${dotClass(row.health)}`} />
          <span className="text-slate-300">{row.label}</span>
          <span className="hidden text-slate-500 sm:inline">· {row.detail}</span>
        </div>
      ))}
    </div>
  );
}
