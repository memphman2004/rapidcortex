"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Incident, TranscriptSegment, VoiceBridgeOutboundResponse } from "rapid-cortex-shared";
import { normalizeCallLanguageCode } from "rapid-cortex-shared";
import {
  fetchDispatcherActiveCalls,
  fetchSilentTextSessions,
  isApiConfigured,
  postLanguageSessionTranslate,
  postSilentTextDispatcherMessage,
  postVoiceBridgeOutbound,
} from "@/lib/api";
import {
  callerLanguageNeedsTranslation,
  resolveIncidentCallerLanguage,
} from "@/lib/dispatch/caller-language";
import {
  isCallerTranslationReplyEnabled,
  isSilentTextEnabled,
  isVoiceBridgeEnabled,
} from "@/lib/runtime-flags";

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

export function DispatcherCallerReplyPanel({
  incidentId,
  incident,
  segments,
  selectedLanguage,
}: {
  incidentId: string | null;
  incident: Incident | null;
  segments: TranscriptSegment[];
  /** Language from the bar above (may be ahead of incident.callerLanguage). */
  selectedLanguage?: string | null;
}) {
  const enabled =
    Boolean(incidentId) && isApiConfigured() && isCallerTranslationReplyEnabled();
  const storedLang = useMemo(
    () => resolveIncidentCallerLanguage(incident, segments),
    [incident, segments],
  );
  const callerLang = useMemo(() => {
    const pick = selectedLanguage?.trim();
    if (pick) return normalizeCallLanguageCode(pick);
    return storedLang;
  }, [selectedLanguage, storedLang]);
  const needsTranslation = callerLanguageNeedsTranslation(callerLang);
  const [draft, setDraft] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [previewErr, setPreviewErr] = useState<string | null>(null);
  const [localErr, setLocalErr] = useState<string | null>(null);
  const [lastVoice, setLastVoice] = useState<VoiceBridgeOutboundResponse | null>(null);
  const debouncedDraft = useDebouncedValue(draft.trim(), 450);

  const silentSessionsQuery = useQuery({
    queryKey: ["silent-text-sessions", incidentId],
    queryFn: () => fetchSilentTextSessions(incidentId!),
    enabled: Boolean(incidentId) && isSilentTextEnabled() && enabled,
    staleTime: 10_000,
  });

  const activeCallQuery = useQuery({
    queryKey: ["dispatcher-active-calls"],
    queryFn: fetchDispatcherActiveCalls,
    enabled: isVoiceBridgeEnabled() && enabled,
    staleTime: 5000,
  });

  const activeSilentSessionId = useMemo(() => {
    const rows = silentSessionsQuery.data ?? [];
    const open = rows.find((s) => !["ended", "canceled", "failed"].includes(s.status));
    return open?.sessionId ?? null;
  }, [silentSessionsQuery.data]);

  const matchedCallId = useMemo(() => {
    if (!incidentId) return undefined;
    const calls = activeCallQuery.data ?? [];
    const match = calls.find(
      (c) => c.incidentId === incidentId && c.status !== "ended" && !c.pendingTransfer,
    );
    return match?.callId;
  }, [activeCallQuery.data, incidentId]);

  useEffect(() => {
    if (!enabled || !incidentId || !debouncedDraft || !needsTranslation || !callerLang) {
      setPreview(null);
      setPreviewErr(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await postLanguageSessionTranslate(incidentId, {
          text: debouncedDraft,
          targetLanguage: callerLang,
          sourceLanguage: "en",
        });
        if (!cancelled) {
          setPreview(res.translatedText);
          setPreviewErr(null);
        }
      } catch (e) {
        if (!cancelled) {
          setPreview(null);
          setPreviewErr(e instanceof Error ? e.message : "Translation preview failed");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [callerLang, debouncedDraft, enabled, incidentId, needsTranslation]);

  const sendTextMut = useMutation({
    mutationFn: async () => {
      if (!incidentId || !activeSilentSessionId) throw new Error("Open a Silent Text session first.");
      return postSilentTextDispatcherMessage(incidentId, activeSilentSessionId, { text: draft.trim() });
    },
    onSuccess: () => {
      setDraft("");
      setLocalErr(null);
    },
    onError: (e: Error) => setLocalErr(e.message),
  });

  const voiceMut = useMutation({
    mutationFn: async () => {
      if (!incidentId) throw new Error("No incident");
      if (!callerLang || !needsTranslation) {
        throw new Error("Select a non-English caller language first.");
      }
      return postVoiceBridgeOutbound(incidentId, {
        text: draft.trim(),
        targetLanguage: callerLang,
        callId: matchedCallId,
      });
    },
    onSuccess: (res) => {
      setLastVoice(res);
      setLocalErr(null);
    },
    onError: (e: Error) => setLocalErr(e.message),
  });

  const onSendText = useCallback(() => {
    if (!draft.trim()) return;
    sendTextMut.mutate();
  }, [draft, sendTextMut]);

  if (!enabled || !incidentId) return null;

  const canPlayVoice = Boolean(draft.trim()) && needsTranslation && !voiceMut.isPending;
  const voiceDisabledReason = !draft.trim()
    ? "Type an English message first"
    : !needsTranslation
      ? "Select a non-English caller language above"
      : voiceMut.isPending
        ? "Queuing…"
        : undefined;

  return (
    <div className="shrink-0 border-b border-violet-900/40 bg-violet-950/20 px-4 py-3">
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-violet-200/90">
        Reply to caller (English → {callerLang ?? "…"})
      </h3>
      <p className="mt-0.5 text-[11px] text-slate-400">
        Type in English. Preview updates as you type; send via Silent Text or queue voice on the live call path.
      </p>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={2}
        placeholder="Type your message in English…"
        className="mt-2 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100"
      />
      {needsTranslation && preview ? (
        <p className="mt-2 rounded border border-sky-900/50 bg-sky-950/30 px-2 py-1.5 text-xs text-sky-100">
          <span className="text-[10px] uppercase text-sky-400/90">Caller will hear/read: </span>
          {preview}
        </p>
      ) : null}
      {previewErr ? (
        <p className="mt-1 text-[11px] text-amber-300" role="status">
          {previewErr}
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-2">
        {isSilentTextEnabled() ? (
          <button
            type="button"
            disabled={!draft.trim() || !activeSilentSessionId || sendTextMut.isPending}
            onClick={onSendText}
            className="rounded bg-violet-700 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-violet-600 disabled:opacity-40"
            title={activeSilentSessionId ? undefined : "Start a Silent Text session in the media panel"}
          >
            {sendTextMut.isPending ? "Sending…" : "Send via Silent Text"}
          </button>
        ) : null}
        {isVoiceBridgeEnabled() ? (
          <button
            type="button"
            disabled={!canPlayVoice}
            onClick={() => voiceMut.mutate()}
            title={voiceDisabledReason}
            className="rounded border border-emerald-800 bg-emerald-950/40 px-3 py-1.5 text-[11px] font-medium text-emerald-100 hover:bg-emerald-950/70 disabled:opacity-40"
          >
            {voiceMut.isPending ? "Queuing…" : "Play on call (voice bridge)"}
          </button>
        ) : null}
      </div>
      {!activeSilentSessionId && isSilentTextEnabled() ? (
        <p className="mt-1 text-[10px] text-slate-500">No active Silent Text session — open one under Caller media.</p>
      ) : null}
      {isVoiceBridgeEnabled() && matchedCallId ? (
        <p className="mt-1 text-[10px] text-emerald-400/90">Linked call: {matchedCallId.slice(0, 12)}…</p>
      ) : isVoiceBridgeEnabled() && needsTranslation ? (
        <p className="mt-1 text-[10px] text-slate-500">
          No linked live call yet — playback still queues to the telephony adapter when configured.
        </p>
      ) : null}
      {lastVoice ? (
        <p className="mt-1 text-[10px] text-slate-500" role="status">
          Voice queued ({lastVoice.deliveryMode}, {lastVoice.telephonyStatus})
          {lastVoice.deliveryMode === "mock"
            ? " — telephony webhook not configured; caller will not hear live audio until voice bridge is connected to your call path."
            : lastVoice.deliveryMode === "text_only"
              ? " — audio delivery was skipped; check TTS / telephony adapter."
              : null}
        </p>
      ) : null}
      {localErr ? (
        <p className="mt-1 text-[11px] text-rose-400" role="alert">
          {localErr}
        </p>
      ) : null}
    </div>
  );
}
