"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toE164 } from "rapid-cortex-shared";
import type { PreArrivalSession } from "rapid-cortex-shared";
import {
  fetchPreArrivalSession,
  fetchPreArrivalSessions,
  isApiConfigured,
  postPreArrivalEta,
  postPreArrivalSession,
  postPreArrivalSessionEnd,
} from "@/lib/api";
import { isPreArrivalIqEnabled } from "@/lib/runtime-flags";
import { PhoneInput } from "@/components/ui/phone-input";
import { callerFacingPublicBaseUrl } from "@/lib/caller-facing-public-base";
import { EtaPanel } from "@/components/dispatch/eta-panel";

function statusLabel(status: PreArrivalSession["status"]): string {
  const map: Record<PreArrivalSession["status"], string> = {
    pending_send: "Not sent",
    sms_sent: "SMS sent",
    opened: "Opened",
    active: "Active",
    terminated: "Terminated",
    ended: "Ended",
    failed: "Failed",
  };
  return map[status] ?? status;
}

export function PreArrivalPanel({
  incidentId,
  ani,
  cadNatureCode,
  embedded = false,
}: {
  incidentId: string | null;
  ani?: string | null;
  cadNatureCode?: string | null;
  embedded?: boolean;
}) {
  const queryClient = useQueryClient();
  const enabled = isPreArrivalIqEnabled();
  const configured = isApiConfigured();
  const [activeToken, setActiveToken] = useState<string | null>(null);
  const [phoneE164, setPhoneE164] = useState<string | null>(null);
  const [stayOnLine, setStayOnLine] = useState(true);
  const [showRequest, setShowRequest] = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);

  useEffect(() => {
    setPhoneE164(toE164(ani));
  }, [ani, incidentId]);

  const sessionsQuery = useQuery({
    queryKey: ["pre-arrival-sessions", incidentId],
    enabled: Boolean(incidentId) && configured && enabled,
    queryFn: () => fetchPreArrivalSessions(incidentId!),
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  useEffect(() => {
    if (activeToken || !sessionsQuery.data?.length) return;
    const preferred = sessionsQuery.data.find((s) => !["ended", "terminated", "failed"].includes(s.status));
    setActiveToken((preferred ?? sessionsQuery.data[0]).sessionToken);
  }, [sessionsQuery.data, activeToken]);

  const sessionQuery = useQuery({
    queryKey: ["pre-arrival-session", incidentId, activeToken],
    enabled: Boolean(incidentId && activeToken && configured && enabled),
    queryFn: () => fetchPreArrivalSession(incidentId!, activeToken!),
    staleTime: 5_000,
    refetchInterval: 10_000,
  });

  const createMut = useMutation({
    mutationFn: async () => {
      if (!incidentId) throw new Error("No incident");
      if (!phoneE164) throw new Error("Enter a valid phone number.");
      return postPreArrivalSession(incidentId, {
        incidentId,
        callerPhoneE164: phoneE164,
        cadNatureCode: cadNatureCode?.trim() || undefined,
        publicAppBaseUrl: callerFacingPublicBaseUrl() || undefined,
        modePolicy: {
          showInstructions: true,
          stayOnLine,
        },
        sendSms: true,
      });
    },
    onSuccess: (res) => {
      setLocalErr(null);
      setShowRequest(false);
      setActiveToken(res.session.sessionToken);
      void queryClient.invalidateQueries({ queryKey: ["pre-arrival-sessions", incidentId] });
    },
    onError: (e: Error) => setLocalErr(e.message),
  });

  const endMut = useMutation({
    mutationFn: async () => {
      if (!incidentId || !activeToken) throw new Error("No session");
      return postPreArrivalSessionEnd(incidentId, activeToken);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pre-arrival-sessions", incidentId] });
      void queryClient.invalidateQueries({ queryKey: ["pre-arrival-session", incidentId, activeToken] });
    },
    onError: (e: Error) => setLocalErr(e.message),
  });

  const etaMut = useMutation({
    mutationFn: async (etaMinutes: number) => {
      if (!incidentId) throw new Error("No incident");
      return postPreArrivalEta(incidentId, { etaMinutes });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pre-arrival-session", incidentId, activeToken] });
      void queryClient.invalidateQueries({ queryKey: ["pre-arrival-sessions", incidentId] });
    },
    onError: (e: Error) => setLocalErr(e.message),
  });

  const session = sessionQuery.data;
  const openSessions = useMemo(
    () => (sessionsQuery.data ?? []).filter((s) => !["ended", "terminated", "failed"].includes(s.status)),
    [sessionsQuery.data],
  );

  if (!enabled) {
    return <p className="text-[12px] text-slate-500">Pre-Arrival iQ is not enabled.</p>;
  }

  return (
    <div className={embedded ? "space-y-3 p-1" : "space-y-3 p-3"}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-400">Pre-Arrival iQ</p>
          <p className="text-[11px] text-slate-500">Caller guidance + ETA while units respond</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowRequest((s) => !s);
            setLocalErr(null);
            const seeded = toE164(ani);
            if (seeded) setPhoneE164(seeded);
          }}
          className="rounded-md bg-sky-700 px-2 py-1 text-xs font-medium text-white hover:bg-sky-600"
        >
          {showRequest ? "Cancel" : "Send link"}
        </button>
      </div>

      {showRequest ? (
        <div className="space-y-2 rounded-md border border-slate-800 bg-slate-950/50 p-2">
          <PhoneInput ani={phoneE164 ?? ani} onChange={setPhoneE164} />
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={stayOnLine}
              onChange={(e) => setStayOnLine(e.target.checked)}
              className="rounded border-slate-600"
            />
            Stay on line banner for caller
          </label>
          <button
            type="button"
            disabled={createMut.isPending}
            onClick={() => createMut.mutate()}
            className="w-full rounded-md bg-sky-700 px-2 py-1.5 text-xs font-medium text-white hover:bg-sky-600 disabled:opacity-50"
          >
            {createMut.isPending ? "Sending…" : "Send Pre-Arrival SMS"}
          </button>
        </div>
      ) : null}

      {openSessions.length > 1 ? (
        <select
          className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
          value={activeToken ?? ""}
          onChange={(e) => setActiveToken(e.target.value || null)}
        >
          {openSessions.map((s) => (
            <option key={s.sessionToken} value={s.sessionToken}>
              {statusLabel(s.status)} · {s.sessionToken.slice(0, 8)}…
            </option>
          ))}
        </select>
      ) : null}

      {session ? (
        <div className="space-y-2 rounded-md border border-slate-800 bg-slate-950/40 p-2 text-xs text-slate-300">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-slate-200">{statusLabel(session.status)}</span>
            <span className="text-slate-500">{session.cadNatureCode}</span>
          </div>
          {session.publicUrl ? (
            <p className="truncate font-mono text-[10px] text-slate-500" title={session.publicUrl}>
              {session.publicUrl}
            </p>
          ) : null}
          <p>
            Instructions: {session.instructions.filter((i) => i.status === "ACTIVE").length} active
            {session.modePolicy?.stayOnLine ? " · stay-on-line" : ""}
          </p>
          {!["ended", "terminated", "failed"].includes(session.status) ? (
            <button
              type="button"
              disabled={endMut.isPending}
              onClick={() => endMut.mutate()}
              className="rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800"
            >
              End session
            </button>
          ) : null}
        </div>
      ) : (
        <p className="text-[12px] text-slate-500">No Pre-Arrival session yet for this incident.</p>
      )}

      {session && !["ended", "terminated", "failed"].includes(session.status) ? (
        <EtaPanel
          lastKnownEtaMinutes={session.lastKnownEtaMinutes}
          lastEtaNotifiedAt={session.lastEtaNotifiedAt}
          onSceneAt={session.onSceneAt}
          notificationCount={session.etaNotifications?.length ?? 0}
          busy={etaMut.isPending}
          onSendEta={(minutes) => etaMut.mutate(minutes)}
        />
      ) : null}

      {localErr ? (
        <p className="text-xs text-rose-300" role="alert">
          {localErr}
        </p>
      ) : null}
    </div>
  );
}
