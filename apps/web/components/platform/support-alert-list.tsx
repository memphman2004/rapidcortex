"use client";

import { AlertTriangle, MessageSquareWarning } from "lucide-react";
import type { ReactNode } from "react";

export type SupportAlert = {
  id: string;
  title: string;
  detail: string;
  severity: "critical" | "warning" | "info";
  /** Optional right-side slot */
  action?: ReactNode;
};

export function SupportAlertList({ items }: { items: SupportAlert[] }) {
  if (items.length === 0) {
    return (
      <p className="rounded-md border border-slate-800/80 bg-slate-900/30 px-3 py-4 text-sm text-slate-500">
        No active operational alerts. Continue monitoring integration status and agency onboarding.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((a) => {
        const border =
          a.severity === "critical"
            ? "border-rose-500/30 bg-rose-950/25"
            : a.severity === "warning"
              ? "border-amber-500/25 bg-amber-950/20"
              : "border-slate-700 bg-slate-900/50";
        const Icon = a.severity === "info" ? MessageSquareWarning : AlertTriangle;
        return (
          <li
            key={a.id}
            className={`flex flex-col gap-1 rounded-md border p-3 sm:flex-row sm:items-start sm:justify-between ${border}`}
          >
            <div className="flex gap-2">
              <Icon
                className={`mt-0.5 h-4 w-4 shrink-0 ${
                  a.severity === "critical" ? "text-rose-300" : "text-amber-200/90"
                }`}
                aria-hidden
              />
              <div>
                <p className="text-sm font-medium text-slate-100">{a.title}</p>
                <p className="mt-0.5 text-xs text-slate-400">{a.detail}</p>
              </div>
            </div>
            {a.action ? <div className="shrink-0 sm:pl-2">{a.action}</div> : null}
          </li>
        );
      })}
    </ul>
  );
}
