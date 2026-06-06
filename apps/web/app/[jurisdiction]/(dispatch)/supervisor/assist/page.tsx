"use client";

import { UserCheck } from "lucide-react";
import { useSession } from "@/components/auth/session-context";
import { isSupervisorOrStaffRole, SupervisorAccessRestricted } from "../_components/supervisor-access";

export default function SupervisorAssistPage() {
  const { user } = useSession();

  if (!isSupervisorOrStaffRole(user?.role)) {
    return <SupervisorAccessRestricted />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 pb-10">
      <div>
        <h1 className="text-xl font-semibold text-white">Supervisor Assist</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">
          Join an active dispatcher session to provide real-time guidance. You assist - the dispatcher retains dispatch
          authority.
        </p>
      </div>

      <div className="rounded-lg border border-sky-800/60 bg-sky-950/20 p-4 text-sm text-sky-100">
        Supervisor Assist does not transfer dispatch authority. The dispatcher remains responsible for all CAD actions
        and incident decisions.
      </div>

      <div className="flex flex-col items-center justify-center rounded-lg border border-slate-800 bg-slate-950/40 py-16 text-center">
        <UserCheck className="mb-4 h-10 w-10 text-slate-600" />
        <h2 className="text-lg font-semibold text-slate-300">No active sessions available to assist.</h2>
        <button
          type="button"
          className="mt-4 rounded-md bg-slate-800 px-3 py-1.5 text-xs font-medium text-sky-300 ring-1 ring-slate-700 hover:bg-slate-700"
          onClick={() => console.log("TODO: join assist", "session-placeholder")}
        >
          Join
        </button>
      </div>
    </div>
  );
}
