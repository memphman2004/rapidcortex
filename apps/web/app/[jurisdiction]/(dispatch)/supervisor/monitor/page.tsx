"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, ShieldAlert } from "lucide-react";
import { useSession } from "@/components/auth/session-context";
import {
  fetchSupervisorOperators,
  isApiConfigured,
  postSupervisorWatching,
} from "@/lib/api";
import { formatRelativeOpened } from "@/lib/format";
import { useJurisdictionLink } from "@/lib/jurisdiction-context";
import { isSupervisorOrStaffRole, SupervisorAccessRestricted } from "../_components/supervisor-access";

export default function SupervisorMonitorPage() {
  const { user } = useSession();
  const to = useJurisdictionLink();
  const qc = useQueryClient();

  const operatorsQuery = useQuery({
    queryKey: ["supervisor-operators"],
    queryFn: fetchSupervisorOperators,
    enabled: isApiConfigured() && isSupervisorOrStaffRole(user?.role),
    refetchInterval: 10_000,
  });

  const watchMutation = useMutation({
    mutationFn: postSupervisorWatching,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["audit-events"] });
    },
  });

  if (!isSupervisorOrStaffRole(user?.role)) {
    return <SupervisorAccessRestricted />;
  }

  const operators = operatorsQuery.data ?? [];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 pb-10">
      <div>
        <h1 className="text-xl font-semibold text-white">Silent Monitor</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">
          Observe active dispatcher sessions in real time. Starting monitor writes a{" "}
          <span className="font-mono text-slate-300">SUPERVISOR_WATCHING</span> audit event.
        </p>
      </div>

      <div className="rounded-lg border border-amber-800/60 bg-amber-950/20 p-4">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
          <p className="text-sm text-amber-100">
            Silent monitoring is subject to your agency&apos;s monitoring policy. Ensure you are
            authorized before monitoring active sessions.
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

        {operatorsQuery.isLoading ? (
          <p className="px-4 py-10 text-center text-sm text-slate-500">Loading live sessions…</p>
        ) : operators.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <Eye className="mb-4 h-10 w-10 text-slate-600" />
            <h2 className="text-lg font-semibold text-slate-300">No active sessions to monitor.</h2>
            <p className="mt-2 max-w-md text-sm text-slate-500">
              Operators appear when a dispatcher (or supervisor) has an open WebSocket to the live
              workspace.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-800">
            {operators.map((op) => (
              <li
                key={op.userId}
                className="grid grid-cols-[1.2fr_1fr_1fr_0.8fr_auto] items-center gap-3 px-4 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-100">{op.displayName}</p>
                  <p className="text-[11px] text-slate-500">{op.role}</p>
                </div>
                <span className="text-slate-400">{formatRelativeOpened(op.connectedAt)}</span>
                <span className="font-mono text-xs text-slate-400">
                  {op.activeIncidentId ?? "—"}
                </span>
                <span
                  className={
                    op.status === "on_call" ? "text-amber-300" : "text-emerald-300"
                  }
                >
                  {op.status === "on_call" ? "On call" : "Online"}
                </span>
                <button
                  type="button"
                  className="rounded-md bg-slate-800 px-3 py-1.5 text-xs font-medium text-sky-300 ring-1 ring-slate-700 hover:bg-slate-700 disabled:opacity-50"
                  disabled={watchMutation.isPending}
                  onClick={() => {
                    void watchMutation.mutateAsync({
                      targetUserId: op.userId,
                      targetDisplayName: op.displayName,
                      incidentId: op.activeIncidentId ?? undefined,
                      sessionId: op.activeCallId ?? undefined,
                    });
                    if (op.activeIncidentId) {
                      window.location.href = `${to("/dispatcher")}?incident=${encodeURIComponent(op.activeIncidentId)}&supervisorWatching=1`;
                    }
                  }}
                >
                  Monitor
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {watchMutation.isSuccess ? (
        <p className="text-xs text-emerald-300">
          Watching audit recorded ({watchMutation.data.eventId}).
        </p>
      ) : null}
      {watchMutation.isError ? (
        <p className="text-xs text-rose-300">Could not record SUPERVISOR_WATCHING audit.</p>
      ) : null}
    </div>
  );
}
