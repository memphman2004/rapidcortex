"use client";

import { Eye, ShieldAlert } from "lucide-react";
import { useSession } from "@/components/auth/session-context";
import { isSupervisorOrStaffRole, SupervisorAccessRestricted } from "../_components/supervisor-access";

export default function SupervisorMonitorPage() {
  const { user } = useSession();

  if (!isSupervisorOrStaffRole(user?.role)) {
    return <SupervisorAccessRestricted />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 pb-10">
      <div>
        <h1 className="text-xl font-semibold text-white">Silent Monitor</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">
          Observe active dispatcher sessions in real time. Your presence is not visible to the dispatcher.
        </p>
      </div>

      <div className="rounded-lg border border-amber-800/60 bg-amber-950/20 p-4">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 text-amber-300" />
          <p className="text-sm text-amber-100">
            Silent monitoring is subject to your agency&apos;s monitoring policy. Ensure you are authorized before
            monitoring active sessions.
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950/40">
        <div className="grid grid-cols-[1.2fr_1fr_1fr_0.8fr_auto] gap-3 border-b border-slate-800 px-4 py-2 text-xs uppercase tracking-wide text-slate-500">
          <span>Dispatcher</span>
          <span>Session Start</span>
          <span>Incident</span>
          <span>Status</span>
          <span>Action</span>
        </div>
        <div className="flex flex-col items-center justify-center py-14 text-center">
          <Eye className="mb-4 h-10 w-10 text-slate-600" />
          <h2 className="text-lg font-semibold text-slate-300">No active sessions to monitor.</h2>
          <button
            type="button"
            className="mt-4 rounded-md bg-slate-800 px-3 py-1.5 text-xs font-medium text-sky-300 ring-1 ring-slate-700 hover:bg-slate-700"
            onClick={() => console.log("TODO: open silent monitor", "session-placeholder")}
          >
            Monitor
          </button>
        </div>
      </div>
    </div>
  );
}
