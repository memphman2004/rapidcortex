"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallAssistConfig } from "@/contexts/call-assist-config-context";
import { isApiConfigured } from "@/lib/api";
import { canTakeOverCallAssistCallback } from "@/lib/call-assist/access";
import { getCallAssistCallbackQueue, postCallAssistCallbackTakeover } from "@/lib/call-assist/call-assist-api";
import { useJurisdictionLink } from "@/lib/jurisdiction-context";
import { isCallAssistEnabled } from "@/lib/runtime-flags";
import { useSession } from "@/components/auth/session-context";

type CallbackRow = {
  callbackId?: string;
  sessionId: string;
  status: string;
  phoneE164?: string;
  dueAt?: string;
  attempts?: unknown[];
  lastError?: string;
};

export function CallAssistCallbackQueue() {
  const { user } = useSession();
  const to = useJurisdictionLink();
  const qc = useQueryClient();
  const { requestAgencyId, agencyId, ready } = useCallAssistConfig();
  const canTakeover = canTakeOverCallAssistCallback(user?.role);
  const enabled = Boolean(isApiConfigured() && isCallAssistEnabled() && ready);

  const query = useQuery({
    queryKey: ["call-assist-callbacks", agencyId],
    queryFn: () => getCallAssistCallbackQueue(requestAgencyId),
    refetchInterval: 8000,
    enabled,
  });

  const takeover = useMutation({
    mutationFn: (sessionId: string) => postCallAssistCallbackTakeover(sessionId, requestAgencyId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["call-assist-callbacks"] }),
  });

  const queued = (query.data?.queued ?? []) as CallbackRow[];
  const inProgress = (query.data?.inProgress ?? []) as CallbackRow[];
  const offered = (query.data?.offered ?? []) as CallbackRow[];
  const rows = [...inProgress, ...queued, ...offered];

  if (!enabled) return null;

  return (
    <section className="mb-4 overflow-hidden rounded-lg border border-slate-800 bg-slate-950/40">
      <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
        <h2 className="text-[12px] font-semibold text-slate-200">Callback campaign</h2>
        <span className="text-[11px] text-slate-500">
          {rows.length} open · live PSTN dial is mock until Connect outbound is configured
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="px-3 py-3 text-[12px] text-slate-500">No offered, queued, or in-progress callbacks.</p>
      ) : (
        <ul className="divide-y divide-slate-800">
          {rows.map((row) => (
            <li key={row.callbackId ?? row.sessionId} className="flex flex-wrap items-center gap-2 px-3 py-2">
              <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-300">
                {row.status}
              </span>
              <Link className="text-[12px] text-sky-400 hover:underline" href={to(`/call-assist/sessions/${row.sessionId}`)}>
                Session {row.sessionId.slice(-8)}
              </Link>
              <span className="font-mono text-[11px] text-slate-500">{row.phoneE164 ?? "no phone"}</span>
              <span className="text-[11px] text-slate-500">due {row.dueAt ? new Date(row.dueAt).toLocaleString() : "—"}</span>
              {row.lastError ? <span className="text-[11px] text-rose-300">{row.lastError}</span> : null}
              {canTakeover && row.status !== "TAKEN_OVER" ? (
                <button
                  type="button"
                  className="ml-auto rounded border border-slate-700 px-2 py-0.5 text-[11px] text-slate-200 hover:text-white"
                  disabled={takeover.isPending}
                  onClick={() => takeover.mutate(row.sessionId)}
                >
                  Dispatcher takeover
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
