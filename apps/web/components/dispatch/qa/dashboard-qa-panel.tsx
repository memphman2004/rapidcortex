"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { isSupervisorOrAdmin } from "rapid-cortex-security";
import type { QaScorecardItem } from "rapid-cortex-shared";
import { useSession } from "@/components/auth/session-context";
import { CoachingNoteCard } from "@/components/dispatch/qa/coaching-note-card";
import { ScorecardForm } from "@/components/dispatch/qa/scorecard-form";
import { isApiConfigured } from "@/lib/api";
import {
  acknowledgeQaScorecard,
  fetchCoachingNotes,
  fetchQaScorecards,
  isQaModuleApiConfigured,
  patchQaScorecard,
  postCoachingNote,
  postQaScorecard,
} from "@/lib/qa-module-api";
import { isQaScoringEnabled } from "@/lib/runtime-flags";

type FormPayload = {
  items: QaScorecardItem[];
  coachingNotes: string;
  followUpRequired: boolean;
};

export function DashboardQaPanel({
  incidentId,
  dispatcherId,
  scorecardId,
  disabled,
}: {
  incidentId: string | null;
  dispatcherId?: string | null;
  scorecardId?: string | null;
  disabled?: boolean;
}) {
  const { user } = useSession();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  const enabled =
    isQaScoringEnabled() &&
    isApiConfigured() &&
    isQaModuleApiConfigured() &&
    Boolean(incidentId) &&
    !disabled;

  const isSupervisor = user ? isSupervisorOrAdmin(user.role) : false;
  const resolvedDispatcherId = dispatcherId ?? (user?.role === "dispatcher" ? user.userId : "");

  const scorecardsQuery = useQuery({
    queryKey: ["qa-scorecards", incidentId, resolvedDispatcherId],
    queryFn: () =>
      fetchQaScorecards({
        incidentId: incidentId ?? undefined,
        dispatcherId: resolvedDispatcherId || undefined,
        limit: 20,
      }),
    enabled: enabled && Boolean(user),
  });

  const active = useMemo(() => {
    const items = scorecardsQuery.data ?? [];
    if (scorecardId) return items.find((s) => s.scorecardId === scorecardId) ?? null;
    return items[0] ?? null;
  }, [scorecardId, scorecardsQuery.data]);

  const coachingQuery = useQuery({
    queryKey: ["qa-coaching-notes", active?.dispatcherId],
    queryFn: () => fetchCoachingNotes(active!.dispatcherId, 10),
    enabled: enabled && Boolean(active?.dispatcherId),
  });

  if (!isQaScoringEnabled() || !isApiConfigured() || !isQaModuleApiConfigured()) {
    return null;
  }

  if (!user || !incidentId) return null;

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["qa-scorecards"] });
    await qc.invalidateQueries({ queryKey: ["qa-coaching-notes"] });
  };

  const saveNew = async (payload: FormPayload, status: "draft" | "submitted") => {
    if (!isSupervisor || !resolvedDispatcherId) return;
    setFormError(null);
    setBusy(true);
    try {
      await postQaScorecard({
        incidentId,
        dispatcherId: resolvedDispatcherId,
        ...payload,
        status,
      });
      setShowNew(false);
      await refresh();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Could not create scorecard");
    } finally {
      setBusy(false);
    }
  };

  const saveExisting = async (payload: FormPayload, status: "draft" | "submitted") => {
    if (!active || !isSupervisor) return;
    setFormError(null);
    setBusy(true);
    try {
      await patchQaScorecard(active.scorecardId, { ...payload, status });
      await refresh();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Could not update scorecard");
    } finally {
      setBusy(false);
    }
  };

  const acknowledge = async () => {
    if (!active) return;
    setBusy(true);
    try {
      await acknowledgeQaScorecard(active.scorecardId);
      await refresh();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Acknowledge failed");
    } finally {
      setBusy(false);
    }
  };

  const addNote = async () => {
    if (!active || !isSupervisor) return;
    const content = window.prompt("Coaching note");
    if (!content?.trim()) return;
    setBusy(true);
    try {
      await postCoachingNote({
        dispatcherId: active.dispatcherId,
        incidentId: active.incidentId,
        scorecardId: active.scorecardId,
        content: content.trim(),
        tags: ["incident"],
      });
      await refresh();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Could not add note");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">QA scorecard</h3>
        {active ? (
          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">{active.status}</span>
        ) : null}
      </div>

      {formError ? (
        <p className="mt-2 text-xs text-rose-300" role="alert">
          {formError}
        </p>
      ) : null}

      {isSupervisor ? (
        <button
          type="button"
          disabled={!enabled || busy}
          onClick={() => setShowNew((v) => !v)}
          className="mt-2 rounded-md bg-slate-800 px-2 py-1 text-xs font-medium text-sky-300 ring-1 ring-slate-700 hover:bg-slate-700 disabled:opacity-40"
        >
          {showNew || !active ? "New review" : "Start another review"}
        </button>
      ) : null}

      {(showNew && isSupervisor) || (!active && isSupervisor) ? (
        <div className="mt-3 border-t border-slate-800 pt-3">
          <ScorecardForm
            busy={busy}
            onSaveDraft={(p) => void saveNew(p, "draft")}
            onSubmit={(p) => void saveNew(p, "submitted")}
          />
        </div>
      ) : active ? (
        <div className="mt-3 space-y-3 border-t border-slate-800 pt-3">
          <p className="font-mono text-[10px] text-slate-500">{active.scorecardId}</p>
          <ScorecardForm
            initialItems={active.items}
            initialCoachingNotes={active.coachingNotes}
            initialFollowUp={active.followUpRequired}
            readOnly={!isSupervisor || active.status === "acknowledged"}
            busy={busy}
            onSaveDraft={isSupervisor ? (p) => void saveExisting(p, "draft") : undefined}
            onSubmit={isSupervisor ? (p) => void saveExisting(p, "submitted") : undefined}
          />
          {!isSupervisor && active.status === "submitted" ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void acknowledge()}
              className="rounded-md bg-teal-950/80 px-2 py-1 text-xs font-medium text-teal-100 ring-1 ring-teal-800 hover:bg-teal-900/80 disabled:opacity-40"
            >
              Acknowledge scorecard
            </button>
          ) : null}
          <div className="space-y-2">
            {(coachingQuery.data ?? []).map((note) => (
              <CoachingNoteCard key={note.noteId} note={note} />
            ))}
          </div>
          {isSupervisor ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void addNote()}
              className="text-xs text-sky-400 hover:text-sky-300 disabled:opacity-40"
            >
              Add coaching note
            </button>
          ) : null}
        </div>
      ) : (
        <p className="mt-2 text-xs text-slate-500">No scorecard for this incident yet.</p>
      )}
    </div>
  );
}
