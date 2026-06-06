"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import type { AIAnalysis, Incident, TranscriptSegment } from "rapid-cortex-shared";
import type { RingRole } from "@/src/features/connect/ring/ring-types";
import {
  ViewAvailableRingCamerasButton,
  isRingAvailableCamerasEnabled,
} from "@/src/features/connect/ring";
import { isApiConfigured, patchIncidentDispatch, postTranscriptSegment } from "@/lib/api";
import { makeId } from "@/lib/ids";

type Toast = { tone: "ok" | "err"; text: string } | null;

export function DispatchActionPanel({
  incidentId,
  incident,
  analysis,
  disabled: disabledExternally = false,
}: {
  incidentId: string | null;
  incident: Incident | null;
  analysis: AIAnalysis | null;
  /** When intelligence is still loading for the active incident. */
  disabled?: boolean;
}) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");

  const invalidate = useCallback(async () => {
    if (!incidentId) return;
    await queryClient.invalidateQueries({ queryKey: ["incidents"] });
    await queryClient.invalidateQueries({ queryKey: ["incident", incidentId] });
  }, [incidentId, queryClient]);

  const applyLocalIncidentPatch = useCallback(
    (patch: Partial<Incident>) => {
      if (!incidentId || !incident) return;
      const next = { ...incident, ...patch, updatedAt: new Date().toISOString() };
      queryClient.setQueryData(["incident", incidentId], next);
      queryClient.setQueryData(["incidents"], (prev: Incident[] | undefined) =>
        prev?.map((i) => (i.incidentId === incidentId ? { ...i, ...patch, updatedAt: next.updatedAt } : i)),
      );
    },
    [incident, incidentId, queryClient],
  );

  const appendLocalNote = useCallback(
    (text: string) => {
      if (!incidentId || !incident) return;
      const seg: TranscriptSegment = {
        segmentId: makeId("seg"),
        incidentId,
        agencyId: incident.agencyId,
        speaker: "dispatcher",
        text: `[Operator note] ${text}`,
        timestamp: new Date().toISOString(),
      };
      queryClient.setQueryData(["transcript", incidentId], (prev: TranscriptSegment[] | undefined) => [
        ...(prev ?? []),
        seg,
      ]);
    },
    [incident, incidentId, queryClient],
  );

  const markReviewed = useCallback(async () => {
    if (!incidentId) return;
    setBusy("review");
    setToast(null);
    try {
      if (isApiConfigured()) {
        const updated = await patchIncidentDispatch(incidentId, { action: "mark_reviewed" });
        queryClient.setQueryData(["incident", incidentId], updated);
        queryClient.setQueryData(["incidents"], (prev: Incident[] | undefined) =>
          prev?.map((i) => (i.incidentId === incidentId ? updated : i)),
        );
      } else {
        applyLocalIncidentPatch({
          dispatcherReviewAcknowledgedAt: new Date().toISOString(),
        });
      }
      setToast({ tone: "ok", text: "Marked as reviewed." });
      await invalidate();
    } catch (e) {
      setToast({
        tone: "err",
        text: e instanceof Error ? e.message : "Could not mark reviewed.",
      });
    } finally {
      setBusy(null);
    }
  }, [applyLocalIncidentPatch, incidentId, invalidate, queryClient]);

  const escalate = useCallback(async () => {
    if (!incidentId) return;
    setBusy("escalate");
    setToast(null);
    try {
      if (isApiConfigured()) {
        const updated = await patchIncidentDispatch(incidentId, { action: "escalate_supervisor" });
        queryClient.setQueryData(["incident", incidentId], updated);
        queryClient.setQueryData(["incidents"], (prev: Incident[] | undefined) =>
          prev?.map((i) => (i.incidentId === incidentId ? updated : i)),
        );
      } else {
        applyLocalIncidentPatch({ escalationFlag: true });
      }
      setToast({ tone: "ok", text: "Escalation flagged for supervisors." });
      await invalidate();
    } catch (e) {
      setToast({
        tone: "err",
        text: e instanceof Error ? e.message : "Could not escalate.",
      });
    } finally {
      setBusy(null);
    }
  }, [applyLocalIncidentPatch, incidentId, invalidate, queryClient]);

  const copySummary = useCallback(async () => {
    setToast(null);
    const text = (analysis?.summary ?? incident?.summary ?? "").trim();
    if (!text) {
      setToast({ tone: "err", text: "No summary to copy yet." });
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setToast({ tone: "ok", text: "Summary copied to clipboard." });
    } catch {
      setToast({ tone: "err", text: "Clipboard unavailable in this browser." });
    }
  }, [analysis?.summary, incident?.summary]);

  const submitNote = useCallback(async () => {
    const trimmed = noteText.trim();
    if (!trimmed || !incidentId || !incident) return;
    setBusy("note");
    setToast(null);
    try {
      if (isApiConfigured()) {
        await postTranscriptSegment(incidentId, {
          speaker: "dispatcher",
          text: `[Operator note] ${trimmed}`,
          timestamp: new Date().toISOString(),
        });
        await queryClient.invalidateQueries({ queryKey: ["transcript", incidentId] });
      } else {
        appendLocalNote(trimmed);
      }
      setNoteText("");
      setNoteOpen(false);
      setToast({ tone: "ok", text: "Operator note added." });
    } catch (e) {
      setToast({
        tone: "err",
        text: e instanceof Error ? e.message : "Could not add note.",
      });
    } finally {
      setBusy(null);
    }
  }, [appendLocalNote, incident, incidentId, noteText, queryClient]);

  const disabled = !incidentId || !incident || disabledExternally;
  const reviewed = Boolean(incident?.dispatcherReviewAcknowledgedAt);
  const escalated = Boolean(incident?.escalationFlag);

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Actions</div>
      {toast ? (
        <p
          className={`mt-2 text-[11px] ${toast.tone === "ok" ? "text-emerald-400/90" : "text-rose-400/90"}`}
          role="status"
        >
          {toast.text}
        </p>
      ) : null}
      <div className="mt-2 grid grid-cols-1 gap-1.5">
        {isRingAvailableCamerasEnabled() && incidentId ? (
          <ViewAvailableRingCamerasButton
            incidentId={incidentId}
            incidentLatitude={incident?.callerLocationLat ?? null}
            incidentLongitude={incident?.callerLocationLng ?? null}
            userRole={"dispatcher" as RingRole}
          />
        ) : null}
        <button
          type="button"
          disabled={disabled || reviewed || busy !== null}
          title={reviewed ? "Already marked reviewed" : "Record that you reviewed the AI output"}
          onClick={() => void markReviewed()}
          className="rounded-md border border-slate-700/80 bg-slate-900/80 px-2 py-1.5 text-left text-xs text-slate-200 hover:border-slate-600 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy === "review" ? "Saving…" : "Mark reviewed"}
        </button>
        <button
          type="button"
          disabled={disabled || busy !== null}
          title="Raise supervisor visibility on this incident"
          onClick={() => void escalate()}
          className="rounded-md border border-slate-700/80 bg-slate-900/80 px-2 py-1.5 text-left text-xs text-slate-200 hover:border-slate-600 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy === "escalate" ? "Saving…" : escalated ? "Escalate again" : "Escalate to supervisor"}
        </button>
        <button
          type="button"
          disabled={disabled || busy !== null}
          onClick={() => void copySummary()}
          className="rounded-md border border-slate-700/80 bg-slate-900/80 px-2 py-1.5 text-left text-xs text-slate-200 hover:border-slate-600 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Copy summary
        </button>
        <button
          type="button"
          disabled={disabled || busy !== null}
          onClick={() => {
            setNoteOpen(true);
            setToast(null);
          }}
          className="rounded-md border border-slate-700/80 bg-slate-900/80 px-2 py-1.5 text-left text-xs text-slate-200 hover:border-slate-600 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Add operator note
        </button>
      </div>

      {noteOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="operator-note-title"
          onClick={() => {
            setNoteOpen(false);
            setNoteText("");
          }}
        >
          <div
            className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-950 p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="operator-note-title" className="text-sm font-semibold text-white">
              Operator note
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Appends a dispatcher line to the transcript with an{" "}
              <span className="font-mono text-slate-400">[Operator note]</span> prefix.
            </p>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={4}
              className="mt-3 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-sky-500 focus:ring-2"
              placeholder="Visible to your agency on this incident transcript…"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-900"
                onClick={() => {
                  setNoteOpen(false);
                  setNoteText("");
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!noteText.trim() || busy === "note"}
                onClick={() => void submitNote()}
                className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-500 disabled:opacity-50"
              >
                {busy === "note" ? "Adding…" : "Add note"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
