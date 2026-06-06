"use client";

import { MessageCircle } from "lucide-react";
import { useSession } from "@/components/auth/session-context";
import { isSupervisorOrStaffRole, SupervisorAccessRestricted } from "../_components/supervisor-access";

export default function SupervisorCoachingPage() {
  const { user } = useSession();

  if (!isSupervisorOrStaffRole(user?.role)) {
    return <SupervisorAccessRestricted />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">Coaching Notes</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Document performance expectations and track follow-up conversations.
          </p>
        </div>
        <button
          type="button"
          className="rounded-md bg-slate-800 px-3 py-2 text-sm font-medium text-sky-300 ring-1 ring-slate-700 hover:bg-slate-700"
          onClick={() => console.log("TODO: create coaching note")}
        >
          New Coaching Note
        </button>
      </div>

      <div className="flex flex-col items-center justify-center rounded-lg border border-slate-800 bg-slate-950/40 py-16 text-center">
        <MessageCircle className="mb-4 h-10 w-10 text-slate-600" />
        <h2 className="text-lg font-semibold text-slate-300">No coaching notes yet.</h2>
      </div>
    </div>
  );
}
