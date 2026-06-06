"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DEFAULT_SILENT_TEXT_PROMPT_TEMPLATES } from "rapid-cortex-shared/silent-text/templates";
import type {
  SilentTextDispatcherSession,
  SilentTextSessionEvent,
} from "rapid-cortex-shared/silent-text/schemas";
import {
  fetchSilentTextSession,
  fetchSilentTextSessions,
  isApiConfigured,
  postSilentTextCancel,
  postSilentTextClose,
  postSilentTextDispatcherMessage,
  postSilentTextHighRisk,
  postSilentTextResend,
  postSilentTextSession,
} from "@/lib/api";

function statusLabel(status: SilentTextDispatcherSession["status"]): string {
  const map: Record<SilentTextDispatcherSession["status"], string> = {
    pending_send: "Not sent",
    sms_sent: "Sent",
    delivered: "Delivered (if supported)",
    opened: "Opened",
    active: "Active",
    inactive: "Inactive",
    ended: "Ended",
    failed: "Failed",
    canceled: "Canceled",
  };
  return map[status] ?? status;
}

export function SilentTextPanel({ incidentId }: { incidentId: string | null }) {
  const queryClient = useQueryClient();
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [publicBase, setPublicBase] = useState("");
  const [highRiskOnCreate, setHighRiskOnCreate] = useState(false);
  const [stealthOnCreate, setStealthOnCreate] = useState(false);
  const [showRequest, setShowRequest] = useState(false);
  const [draft, setDraft] = useState("");
  const [localErr, setLocalErr] = useState<string | null>(null);
  const [minimized, setMinimized] = useState(false);

  const configured = isApiConfigured();

  const sessionsQuery = useQuery({
    queryKey: ["silent-text-sessions", incidentId],
    enabled: Boolean(incidentId) && configured,
    queryFn: () => fetchSilentTextSessions(incidentId!),
    staleTime: 10_000,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });

  useEffect(() => {
    if (activeSessionId || !sessionsQuery.data?.length) return;
    const preferred = sessionsQuery.data.find((s) => !["ended", "canceled", "failed"].includes(s.status));
    setActiveSessionId((preferred ?? sessionsQuery.data[0]).sessionId);
  }, [sessionsQuery.data, activeSessionId]);

  const sessionQuery = useQuery({
    queryKey: ["silent-text-session", incidentId, activeSessionId],
    enabled: Boolean(incidentId && activeSessionId && configured),
    queryFn: () => fetchSilentTextSession(incidentId!, activeSessionId!),
    staleTime: 3_000,
    refetchIntervalInBackground: false,
    refetchInterval: (q) => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        return 10_000;
      }
      const st = q.state.data?.status;
      if (!st || ["ended", "canceled", "failed"].includes(st)) return false;
      if (st === "active") return 2_500;
      return 5_000;
    },
  });

  const session = sessionQuery.data;

  const createMut = useMutation({
    mutationFn: async () => {
      if (!incidentId) throw new Error("No incident");
      const trimmed = phone.trim();
      if (!/^\+[1-9]\d{6,14}$/.test(trimmed)) {
        throw new Error("Enter caller phone in E.164 format (e.g. +15551234567).");
      }
      const body: Parameters<typeof postSilentTextSession>[1] = {
        callerPhoneE164: trimmed,
        highRisk: highRiskOnCreate,
        stealthAppearance: stealthOnCreate,
      };
      const base = publicBase.trim();
      if (base) body.publicAppBaseUrl = base;
      return postSilentTextSession(incidentId, body);
    },
    onSuccess: (data) => {
      setLocalErr(null);
      setActiveSessionId(data.session.sessionId);
      setShowRequest(false);
      void queryClient.invalidateQueries({ queryKey: ["silent-text-sessions", incidentId] });
      void queryClient.invalidateQueries({ queryKey: ["silent-text-session", incidentId, data.session.sessionId] });
    },
    onError: (e: Error) => setLocalErr(e.message),
  });

  const sendMut = useMutation({
    mutationFn: async (payload: { text: string; promptTemplateId?: string }) => {
      if (!incidentId || !activeSessionId) throw new Error("No session");
      return postSilentTextDispatcherMessage(incidentId, activeSessionId, payload);
    },
    onSuccess: () => {
      setLocalErr(null);
      setDraft("");
      void sessionQuery.refetch();
    },
    onError: (e: Error) => setLocalErr(e.message),
  });

  const resendMut = useMutation({
    mutationFn: async () => {
      if (!incidentId || !activeSessionId) throw new Error("No session");
      return postSilentTextResend(incidentId, activeSessionId);
    },
    onSuccess: () => {
      setLocalErr(null);
      void sessionQuery.refetch();
    },
    onError: (e: Error) => setLocalErr(e.message),
  });

  const cancelMut = useMutation({
    mutationFn: async () => {
      if (!incidentId || !activeSessionId) throw new Error("No session");
      return postSilentTextCancel(incidentId, activeSessionId);
    },
    onSuccess: () => void sessionQuery.refetch(),
    onError: (e: Error) => setLocalErr(e.message),
  });

  const closeMut = useMutation({
    mutationFn: async () => {
      if (!incidentId || !activeSessionId) throw new Error("No session");
      return postSilentTextClose(incidentId, activeSessionId);
    },
    onSuccess: () => void sessionQuery.refetch(),
    onError: (e: Error) => setLocalErr(e.message),
  });

  const highRiskMut = useMutation({
    mutationFn: async () => {
      if (!incidentId || !activeSessionId) throw new Error("No session");
      return postSilentTextHighRisk(incidentId, activeSessionId);
    },
    onSuccess: () => void sessionQuery.refetch(),
    onError: (e: Error) => setLocalErr(e.message),
  });

  const recentEvents: SilentTextSessionEvent[] = useMemo(() => (session?.events ?? []).slice(-10), [session?.events]);

  const sendDraft = useCallback(() => {
    const t = draft.trim();
    if (!t) return;
    sendMut.mutate({ text: t });
  }, [draft, sendMut]);

  if (!incidentId) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Silent Text Link</h3>
        <p className="mt-1 text-xs text-slate-500">Select an incident to send a secure text session.</p>
      </div>
    );
  }

  if (!configured) {
    return (
      <div className="rounded-lg border border-amber-900/50 bg-amber-950/20 p-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-wide text-amber-200/90">Silent Text Link</h3>
        <p className="mt-1 text-xs text-amber-100/80">Connect the app to your API to enable SMS and live text.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Silent Text Link</h3>
          <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
            SMS secure link · text-only when speaking is not safe · logged to incident
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={() => setMinimized((m) => !m)}
            className="rounded-md border border-slate-700 px-2 py-1 text-[10px] text-slate-400 hover:bg-slate-800"
          >
            {minimized ? "Expand" : "Hide"}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowRequest((s) => !s);
              setLocalErr(null);
            }}
            className="rounded-md bg-violet-700 px-2 py-1 text-[11px] font-medium text-white hover:bg-violet-600"
          >
            Send Silent Text Link
          </button>
        </div>
      </div>

      {localErr ? (
        <p className="mt-2 text-[11px] text-rose-400" role="alert">
          {localErr}
        </p>
      ) : null}

      {!minimized && showRequest ? (
        <div className="mt-3 space-y-2 rounded-md border border-slate-800 bg-slate-900/60 p-2">
          <label className="block text-[10px] font-medium uppercase tracking-wide text-slate-500">
            Caller mobile (E.164)
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+15551234567"
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 font-mono text-xs text-slate-100"
            />
          </label>
          <label className="block text-[10px] font-medium uppercase tracking-wide text-slate-500">
            Public site base (optional)
            <input
              value={publicBase}
              onChange={(e) => setPublicBase(e.target.value)}
              placeholder="https://app.example.com"
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 font-mono text-xs text-slate-100"
            />
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-[11px] text-slate-300">
            <input type="checkbox" checked={highRiskOnCreate} onChange={(e) => setHighRiskOnCreate(e.target.checked)} />
            Mark as high-risk silent session
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-[11px] text-slate-300">
            <input type="checkbox" checked={stealthOnCreate} onChange={(e) => setStealthOnCreate(e.target.checked)} />
            Stealth caller page (where policy allows)
          </label>
          <button
            type="button"
            disabled={createMut.isPending}
            onClick={() => createMut.mutate()}
            className="w-full rounded-md bg-emerald-700 py-1.5 text-xs font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
          >
            {createMut.isPending ? "Sending…" : "Send SMS link"}
          </button>
        </div>
      ) : null}

      {!minimized && sessionsQuery.data && sessionsQuery.data.length > 0 ? (
        <label className="mt-3 block text-[10px] font-medium uppercase tracking-wide text-slate-500">
          Session
          <select
            value={activeSessionId ?? ""}
            onChange={(e) => setActiveSessionId(e.target.value || null)}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 font-mono text-[11px] text-slate-100"
          >
            {sessionsQuery.data.map((s) => (
              <option key={s.sessionId} value={s.sessionId}>
                {s.sessionId.slice(0, 10)}… · {s.status}
                {s.highRisk ? " · HR" : ""}
              </option>
            ))}
          </select>
        </label>
      ) : !minimized ? (
        <p className="mt-2 text-[11px] text-slate-500">No silent text sessions for this incident yet.</p>
      ) : null}

      {!minimized && session ? (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${
                session.highRisk
                  ? "bg-rose-950/50 text-rose-100 ring-rose-800"
                  : "bg-slate-800 text-violet-200 ring-slate-600"
              }`}
            >
              {statusLabel(session.status)}
            </span>
            {session.highRisk ? (
              <span className="text-[10px] font-medium text-rose-300">High-risk</span>
            ) : null}
          </div>

          <div className="max-h-48 space-y-1.5 overflow-y-auto rounded border border-slate-800/80 bg-slate-900/50 p-2">
            {session.messages.length === 0 ? (
              <p className="text-[11px] text-slate-500">No messages yet.</p>
            ) : (
              session.messages.map((m) => (
                <div
                  key={m.messageId}
                  className={`rounded px-2 py-1.5 text-xs leading-snug ${
                    m.from === "dispatcher" ? "ml-4 bg-violet-950/40 text-violet-100" : "mr-4 bg-slate-800 text-slate-100"
                  }`}
                >
                  <span className="text-[9px] uppercase text-slate-500">{m.from}</span>
                  <p className="mt-0.5 whitespace-pre-wrap">{m.body}</p>
                  <p className="mt-0.5 text-[9px] text-slate-500">{new Date(m.at).toLocaleTimeString()}</p>
                </div>
              ))
            )}
          </div>

          <div className="flex flex-wrap gap-1">
            {DEFAULT_SILENT_TEXT_PROMPT_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                disabled={sendMut.isPending || ["ended", "canceled", "failed"].includes(session.status)}
                onClick={() => sendMut.mutate({ text: tpl.text, promptTemplateId: tpl.id })}
                className="rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] text-slate-200 hover:bg-slate-800 disabled:opacity-40"
              >
                {tpl.label}
              </button>
            ))}
          </div>

          <div className="flex gap-1">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
              placeholder="Type a short message…"
              className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
            />
            <button
              type="button"
              disabled={!draft.trim() || sendMut.isPending || ["ended", "canceled", "failed"].includes(session.status)}
              onClick={sendDraft}
              className="shrink-0 self-end rounded-md bg-violet-600 px-3 py-2 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-40"
            >
              Send
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              disabled={resendMut.isPending || ["ended", "canceled", "failed"].includes(session.status)}
              onClick={() => resendMut.mutate()}
              className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-800 disabled:opacity-40"
            >
              Resend SMS
            </button>
            <button
              type="button"
              disabled={highRiskMut.isPending || session.highRisk || ["ended", "canceled"].includes(session.status)}
              onClick={() => highRiskMut.mutate()}
              className="rounded border border-rose-900/50 bg-rose-950/30 px-2 py-1 text-[11px] text-rose-100 hover:bg-rose-950/50 disabled:opacity-40"
            >
              Mark high-risk
            </button>
            <button
              type="button"
              disabled={cancelMut.isPending || ["ended", "canceled"].includes(session.status)}
              onClick={() => cancelMut.mutate()}
              className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-800 disabled:opacity-40"
            >
              Cancel link
            </button>
            <button
              type="button"
              disabled={closeMut.isPending || ["ended", "canceled"].includes(session.status)}
              onClick={() => closeMut.mutate()}
              className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-700 disabled:opacity-40"
            >
              Close session
            </button>
          </div>

          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Milestones</div>
            <ul className="mt-1 max-h-20 space-y-0.5 overflow-y-auto font-mono text-[10px] text-slate-400">
              {recentEvents.length === 0 ? (
                <li className="text-slate-600">No events.</li>
              ) : (
                recentEvents.map((ev, i) => (
                  <li key={`${ev.at}-${i}`} className="truncate">
                    {new Date(ev.at).toLocaleTimeString()} · {ev.type}
                  </li>
                ))
              )}
            </ul>
          </div>

          <p className="text-[10px] leading-snug text-slate-600">
            Supervisor transfer and translation hooks follow your agency Command seat and language settings. Escalate to
            Caller Video Assist from the panel above when the caller can safely enable video.
          </p>
        </div>
      ) : activeSessionId && !minimized ? (
        <p className="mt-2 text-xs text-slate-500">Loading session…</p>
      ) : null}
    </div>
  );
}
