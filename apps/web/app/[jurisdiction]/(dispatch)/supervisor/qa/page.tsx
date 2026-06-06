"use client";

import { useState } from "react";
import Link from "next/link";
import { BarChart2, ClipboardCheck } from "lucide-react";
import { useJurisdictionLink } from "@/lib/jurisdiction-context";
import { isQaScoringEnabled } from "@/lib/runtime-flags";
import { useSession } from "@/components/auth/session-context";
import { isSupervisorOrStaffRole, SupervisorAccessRestricted } from "../_components/supervisor-access";

export default function SupervisorQaQueuePage() {
  const to = useJurisdictionLink();
  const { user } = useSession();
  const [filter, setFilter] = useState<"all" | "pending" | "completed">("all");

  if (!isSupervisorOrStaffRole(user?.role)) {
    return <SupervisorAccessRestricted />;
  }

  if (!isQaScoringEnabled()) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <BarChart2 className="mb-4 h-10 w-10 text-slate-600" />
        <h2 className="text-lg font-semibold text-slate-300">QA Scoring</h2>
        <p className="mt-2 max-w-sm text-sm text-slate-500">
          QA scoring is not enabled for this agency configuration. Contact your administrator to enable this feature.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 pb-10">
      <div>
        <h1 className="text-xl font-semibold text-white">QA Review</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">
          Score call sessions, annotate performance, and track follow-ups.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Pending Review</p>
          <p className="mt-2 text-2xl font-semibold text-white">0</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Completed This Week</p>
          <p className="mt-2 text-2xl font-semibold text-white">0</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Avg Score This Month</p>
          <p className="mt-2 text-2xl font-semibold text-white">—</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["all", "pending", "completed"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setFilter(mode)}
            className={`rounded-md px-3 py-1.5 text-sm ${
              filter === mode ? "bg-sky-600 text-white" : "bg-slate-800 text-slate-300"
            }`}
          >
            {mode === "all" ? "All" : mode === "pending" ? "Pending" : "Completed"}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950/40">
        <div className="grid grid-cols-[1.5fr_1.2fr_1.2fr_1fr_0.8fr_1fr_auto] gap-3 border-b border-slate-800 px-4 py-2 text-xs uppercase tracking-wide text-slate-500">
          <span>Session ID</span>
          <span>Dispatcher</span>
          <span>Date</span>
          <span>Duration</span>
          <span>Score</span>
          <span>Status</span>
          <span>Action</span>
        </div>
        <div className="flex flex-col items-center justify-center py-14 text-center">
          <ClipboardCheck className="mb-4 h-10 w-10 text-slate-600" />
          <h2 className="text-lg font-semibold text-slate-300">No sessions available for QA review.</h2>
          <Link
            href={to("/supervisor/qa/session-placeholder")}
            className="mt-4 rounded-md bg-slate-800 px-3 py-1.5 text-xs font-medium text-sky-300 ring-1 ring-slate-700 hover:bg-slate-700"
          >
            Review
          </Link>
        </div>
      </div>
    </div>
  );
}
