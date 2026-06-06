"use client";

import { useState } from "react";
import { BarChart2 } from "lucide-react";
import { useSession } from "@/components/auth/session-context";
import { isSupervisorOrStaffRole, SupervisorAccessRestricted } from "../_components/supervisor-access";

export default function SupervisorPerformancePage() {
  const { user } = useSession();
  const [range, setRange] = useState<"today" | "week" | "month">("week");

  if (!isSupervisorOrStaffRole(user?.role)) {
    return <SupervisorAccessRestricted />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-6 text-slate-100">
      <header>
        <h1 className="text-lg font-semibold text-white">Team Performance</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">
          Team-level operational metrics and coaching trends.
        </p>
      </header>
      <div className="flex gap-2">
        {(["today", "week", "month"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setRange(value)}
            className={`rounded-md px-3 py-1.5 text-sm ${
              range === value ? "bg-sky-600 text-white" : "bg-slate-800 text-slate-300"
            }`}
          >
            {value === "today" ? "Today" : value === "week" ? "This Week" : "This Month"}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          "Active Dispatchers",
          "Avg Handle Time",
          "Calls Processed",
          "Escalations",
        ].map((metric) => (
          <div key={metric} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">{metric}</p>
            <p className="mt-2 text-2xl font-semibold text-white">—</p>
          </div>
        ))}
      </div>

      <section className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950/40">
        <div className="grid grid-cols-[1.2fr_0.9fr_1fr_0.8fr_0.7fr_0.8fr] gap-3 border-b border-slate-800 px-4 py-2 text-xs uppercase tracking-wide text-slate-500">
          <span>Dispatcher</span>
          <span>Sessions</span>
          <span>Avg Handle Time</span>
          <span>QA Score</span>
          <span>Trend</span>
          <span>Status</span>
        </div>
        <div className="flex flex-col items-center justify-center py-14 text-center">
          <BarChart2 className="mb-4 h-10 w-10 text-slate-600" />
          <h2 className="text-lg font-semibold text-slate-300">
            Performance data will appear here once sessions are logged.
          </h2>
        </div>
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
        <h2 className="text-sm font-semibold text-slate-200">Call Quality Trend — Last 30 Days</h2>
        <div className="mt-4 flex h-40 items-end gap-2 rounded-md border border-slate-800 bg-slate-900/30 p-3">
          {[24, 32, 28, 41, 36, 45, 39, 48, 44, 52, 47, 50].map((height, index) => (
            <div key={index} className="flex-1 rounded-sm bg-sky-600/50" style={{ height: `${height}%` }} />
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500">Connect QA scoring to see trend data.</p>
      </section>
    </div>
  );
}
