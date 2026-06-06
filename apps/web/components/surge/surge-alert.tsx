"use client";

import { useEffect, useState } from "react";

export type SurgeAlertPriority = "critical" | "high" | "medium" | "low";

const PRIORITY_CONFIG: Record<
  SurgeAlertPriority,
  { icon: string; border: string; badge: string }
> = {
  critical: { icon: "🚨", border: "border-rose-500", badge: "bg-rose-600" },
  high: { icon: "⚠️", border: "border-amber-500", badge: "bg-amber-600" },
  medium: { icon: "ℹ️", border: "border-sky-500", badge: "bg-sky-600" },
  low: { icon: "📍", border: "border-slate-500", badge: "bg-slate-600" },
};

export function SurgeAlert({
  clusterId: _clusterId,
  callCount,
  incidentType,
  location,
  priority,
  onView,
  onDismiss,
}: {
  clusterId: string;
  callCount: number;
  incidentType: string;
  location: string;
  priority: SurgeAlertPriority;
  onView: () => void;
  onDismiss: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const cfg = PRIORITY_CONFIG[priority];

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  const dismiss = () => {
    setVisible(false);
    setTimeout(onDismiss, 250);
  };

  return (
    <div
      className={`transform transition-all duration-300 ${
        visible ? "translate-x-0 opacity-100" : "translate-x-6 opacity-0"
      }`}
    >
      <div
        className={`overflow-hidden rounded-lg border-2 ${cfg.border} bg-slate-950/90 shadow-lg backdrop-blur-sm`}
      >
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className="text-2xl">{cfg.icon}</div>
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <h4 className="text-sm font-bold text-white">Surge View pattern detected</h4>
                <span className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase text-white ${cfg.badge}`}>
                  {priority}
                </span>
              </div>
              <p className="text-xs text-slate-300">
                <span className="font-semibold text-white">{callCount}</span> callers —{" "}
                <span className="font-semibold text-white">{incidentType}</span>
              </p>
              <p className="mt-1 text-[11px] text-slate-500">{location}</p>
            </div>
            <button
              type="button"
              className="shrink-0 text-lg leading-none text-slate-500 hover:text-white"
              onClick={dismiss}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={onView}
              className="flex-1 rounded-lg bg-sky-600 px-3 py-2 text-xs font-medium text-white hover:bg-sky-500"
            >
              View cluster
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
