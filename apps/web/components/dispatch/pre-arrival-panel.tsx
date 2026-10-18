"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  PRE_ARRIVAL_REASON_PRESETS,
  callerGuidancePresentation,
  isPreArrivalReasonMissing,
  resolveResponseIQInstructions,
  toE164,
} from "rapid-cortex-shared";
import type { PreArrivalSession } from "rapid-cortex-shared";
import {
  fetchPreArrivalChannel,
  fetchPreArrivalSession,
  fetchPreArrivalSessions,
  postPreArrivalDispatcherReply,
  isApiConfigured,
  postPreArrivalEta,
  postPreArrivalSession,
  postPreArrivalSessionEnd,
} from "@/lib/api";
import { isPreArrivalIqEnabled } from "@/lib/runtime-flags";
import { PhoneInput } from "@/components/ui/phone-input";
import { callerFacingPublicBaseUrl } from "@/lib/caller-facing-public-base";
import { EtaPanel } from "@/components/dispatch/eta-panel";

function CallerChannelPanel({
  incidentId,
  sessionToken,
  reply,
  onReply,
}: {
  incidentId: string;
  sessionToken: string;
  reply: string;
  onReply: (value: string) => void;
}) {
  const queryClient = useQueryClient();
  const channelQuery = useQuery({
    queryKey: ["pre-arrival-channel", incidentId, sessionToken],
    queryFn: () => fetchPreArrivalChannel(incidentId, sessionToken),
    refetchInterval: 10_000,
  });
  const replyMut = useMutation({
    mutationFn: () => postPreArrivalDispatcherReply(incidentId, sessionToken, reply.trim()),
    onSuccess: async () => {
      onReply("");
      await queryClient.invalidateQueries({ queryKey: ["pre-arrival-channel", incidentId, sessionToken] });
    },
  });
  const messages = channelQuery.data?.messages ?? [];
  return (
    <div className="space-y-2 rounded-md border border-slate-800 bg-slate-950/40 p-2 text-xs text-slate-300">
      <p className="font-medium text-slate-200">Caller channel</p>
      <ul className="max-h-40 space-y-1 overflow-y-auto">
        {messages.length === 0 ? <li className="text-slate-500">No caller updates yet.</li> : null}
        {messages.map((message) => (
          <li key={message.messageId} className="rounded bg-slate-900 px-2 py-1">
            <span className="text-slate-500">{message.from === "dispatcher" ? "You" : "Caller"} · {message.kind}</span>
            <p>{message.text}</p>
            {message.latitude != null && message.longitude != null ? (
              <p className="font-mono text-[10px] text-slate-400">
                {message.latitude.toFixed(5)}, {message.longitude.toFixed(5)}
              </p>
            ) : null}
            {message.viewUrl ? (
              <a href={message.viewUrl} target="_blank" rel="noreferrer" className="text-sky-400 underline">
                Open {message.kind}
              </a>
            ) : null}
          </li>
        ))}
      </ul>
      <textarea
        value={reply}
        maxLength={500}
        rows={2}
        onChange={(event) => onReply(event.target.value)}
        placeholder="Reply to the caller"
        className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
      />
      <button
        type="button"
        disabled={replyMut.isPending || !reply.trim()}
        onClick={() => replyMut.mutate()}
        className="rounded bg-sky-700 px-2 py-1 text-[11px] font-medium text-white disabled:opacity-50"
      >
        Send reply
      </button>
    </div>
  );
}

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
  const [reasonPresetId, setReasonPresetId] = useState<string>("incident");
  const [localErr, setLocalErr] = useState<string | null>(null);
  const [reply, setReply] = useState("");

  const selectedPreset = PRE_ARRIVAL_REASON_PRESETS.find((preset) => preset.id === reasonPresetId);
  const natureForSend = (selectedPreset?.code || cadNatureCode || "").trim();
  const preview = useMemo(() => {
    const resolved = resolveResponseIQInstructions({
      cadNatureCode: natureForSend || "UNKNOWN",
    });
    return {
      ...resolved,
      copy: callerGuidancePresentation(natureForSend || "UNKNOWN"),
    };
  }, [natureForSend]);

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
      if (isPreArrivalReasonMissing(natureForSend)) {
        throw new Error("Choose a call reason before sending.");
      }
      return postPreArrivalSession(incidentId, {
        incidentId,
        callerPhoneE164: phoneE164,
        cadNatureCode: natureForSend || undefined,
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
          <p className="text-[11px] text-slate-500">What the caller will see while units respond</p>
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
          <label className="block text-[11px] text-slate-400">
            Reason the caller should see
            <select
              className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
              value={reasonPresetId}
              onChange={(e) => setReasonPresetId(e.target.value)}
            >
              {PRE_ARRIVAL_REASON_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.id === "incident"
                    ? `${preset.label}${cadNatureCode ? ` (${cadNatureCode})` : " (not set)"}`
                    : preset.label}
                </option>
              ))}
            </select>
          </label>
          <div className="rounded border border-slate-800 bg-slate-900/80 px-2 py-2 text-[11px] text-slate-300">
            <p className="font-medium text-slate-100">{preview.copy.headline}</p>
            <p className="mt-1 text-slate-400">{preview.copy.heardLine}</p>
            <ol className="mt-2 list-decimal space-y-1 pl-4">
              {preview.instructions.map((step) => (
                <li key={step.stepId}>{step.text}</li>
              ))}
            </ol>
            {isPreArrivalReasonMissing(natureForSend) ? (
              <p className="mt-2 text-amber-300">Choose a call reason before sending. The link stays blocked until you do.</p>
            ) : null}
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={stayOnLine}
              onChange={(e) => setStayOnLine(e.target.checked)}
              className="rounded border-slate-600"
            />
            Tell them to keep the call open
          </label>
          <button
            type="button"
            disabled={createMut.isPending || isPreArrivalReasonMissing(natureForSend)}
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
          <p className="text-slate-400">{callerGuidancePresentation(session.cadNatureCode).heardLine}</p>
          <ol className="list-decimal space-y-1 pl-4">
            {session.instructions.map((step) => (
              <li key={step.stepId} className={step.status === "COMPLETED" ? "text-emerald-400" : undefined}>
                {step.text}
                {step.status === "COMPLETED" ? " — caller marked done" : ""}
              </li>
            ))}
          </ol>
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

      {incidentId && session && session.sessionMode !== "STATUS_ONLY" && !["ended", "terminated", "failed"].includes(session.status) ? (
        <CallerChannelPanel
          incidentId={incidentId}
          sessionToken={session.sessionToken}
          reply={reply}
          onReply={setReply}
        />
      ) : null}

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
