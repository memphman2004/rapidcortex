"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { isSupervisorOrAdmin } from "rapid-cortex-security";
import type { QaScorecard } from "rapid-cortex-shared";
import { useSession } from "@/components/auth/session-context";
import { CallQualityChart } from "@/components/dispatch/qa/call-quality-chart";
import { CoachingNoteCard } from "@/components/dispatch/qa/coaching-note-card";
import { ScorecardForm } from "@/components/dispatch/qa/scorecard-form";
import {
  acknowledgeQaScorecard,
  fetchCoachingNotes,
  fetchQaScorecards,
  fetchQaTrends,
  isQaModuleApiConfigured,
  patchQaScorecard,
  postCoachingNote,
  postQaScorecard,
} from "@/lib/qa-module-api";
import { useJurisdictionLink } from "@/lib/jurisdiction-context";
import { isQaScoringEnabled } from "@/lib/runtime-flags";

function SectionHead({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-2">
      <h2 className="text-sm font-semibold text-slate-200">{title}</h2>
      {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b border-slate-800/80 py-2 text-xs last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="text-right text-slate-200">{value}</span>
    </div>
  );
}

export function QaDashboardPage() {
  const { user } = useSession();
  const router = useRouter();
  const toPath = useJurisdictionLink();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dispatcherFilter, setDispatcherFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | QaScorecard["status"]>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newReview, setNewReview] = useState(false);
  const [newIncidentId, setNewIncidentId] = useState("");
  const [newDispatcherId, setNewDispatcherId] = useState("");

  const enabled = isQaScoringEnabled() && isQaModuleApiConfigured();
  const isSupervisor = user ? isSupervisorOrAdmin(user.role) : false;

  const scorecardsQuery = useQuery({
    queryKey: ["qa-scorecards", dispatcherFilter],
    queryFn: () =>
      fetchQaScorecards({
        dispatcherId: dispatcherFilter || undefined,
        limit: 80,
      }),
    enabled: enabled && Boolean(user),
  });

  const trendsQuery = useQuery({
    queryKey: ["qa-trends", dispatcherFilter],
    queryFn: () =>
      fetchQaTrends({
        period: "week",
        weeks: 12,
        dispatcherId: dispatcherFilter || undefined,
      }),
    enabled: enabled && Boolean(user),
  });

  const selected = useMemo(
    () => (scorecardsQuery.data ?? []).find((s) => s.scorecardId === selectedId) ?? null,
    [scorecardsQuery.data, selectedId],
  );

  const filtered = useMemo(() => {
    let rows = scorecardsQuery.data ?? [];
    if (statusFilter) rows = rows.filter((r) => r.status === statusFilter);
    return rows;
  }, [scorecardsQuery.data, statusFilter]);

  const coachingQuery = useQuery({
    queryKey: ["qa-coaching-notes", selected?.dispatcherId],
    queryFn: () => fetchCoachingNotes(selected!.dispatcherId, 20),
    enabled: enabled && Boolean(selected?.dispatcherId),
  });

  if (!enabled) {
    return (
      <div className="p-6 text-sm text-slate-400">
        QA module requires API configuration and <code className="text-slate-300">NEXT_PUBLIC_ENABLE_QA_SCORING=1</code>.
      </div>
    );
  }

  if (!user) return null;

  if (!isSupervisor && user.role === "dispatcher") {
    router.replace(toPath("/dispatcher/dashboard"));
    return null;
  }

  if (!isSupervisor) {
    return <div className="p-6 text-sm text-slate-400">QA dashboard is limited to supervisors and admins.</div>;
  }

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["qa-scorecards"] });
    await qc.invalidateQueries({ queryKey: ["qa-trends"] });
    await qc.invalidateQueries({ queryKey: ["qa-coaching-notes"] });
  };

  const createScorecard = async (
    payload: { items: QaScorecard["items"]; coachingNotes: string; followUpRequired: boolean },
    status: "draft" | "submitted",
  ) => {
    setError(null);
    setBusy(true);
    try {
      const created = await postQaScorecard({
        incidentId: newIncidentId,
        dispatcherId: newDispatcherId,
        items: payload.items,
        coachingNotes: payload.coachingNotes,
        followUpRequired: payload.followUpRequired,
        status,
      });
      setNewReview(false);
      setSelectedId(created.scorecardId);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save scorecard");
    } finally {
      setBusy(false);
    }
  };

  const updateSelected = async (
    payload: { items: QaScorecard["items"]; coachingNotes: string; followUpRequired: boolean },
    status: "draft" | "submitted",
  ) => {
    if (!selected) return;
    setError(null);
    setBusy(true);
    try {
      await patchQaScorecard(selected.scorecardId, {
        items: payload.items,
        coachingNotes: payload.coachingNotes,
        followUpRequired: payload.followUpRequired,
        status,
      });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update scorecard");
    } finally {
      setBusy(false);
    }
  };

  const addCoachingNote = async (content: string) => {
    if (!selected) return;
    setBusy(true);
    try {
      await postCoachingNote({
        dispatcherId: selected.dispatcherId,
        incidentId: selected.incidentId,
        scorecardId: selected.scorecardId,
        content,
        tags: ["coaching"],
      });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add coaching note");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 text-slate-100 md:p-6">
      <header>
        <h1 className="text-xl font-semibold text-white">QA scorecards & trends</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-400">
          Supervisor scorecards, coaching notes, and call-quality trends for your agency.
        </p>
      </header>

      {error ? (
        <p className="text-sm text-rose-300" role="alert">
          {error}
        </p>
      ) : null}

      <CallQualityChart
        trends={trendsQuery.data?.trends ?? []}
        agencyTrends={trendsQuery.data?.agencyTrends ?? []}
      />

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <section className="flex min-h-0 flex-col rounded-lg border border-slate-700/60 bg-slate-950/80 p-3">
          <SectionHead title="Recent scorecards" hint="Filter by dispatcher or status" />
          <div className="mb-3 flex flex-col gap-2">
            <input
              value={dispatcherFilter}
              onChange={(e) => setDispatcherFilter(e.target.value)}
              placeholder="Dispatcher user id"
              className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "" | QaScorecard["status"])}
              className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
            >
              <option value="">All statuses</option>
              <option value="draft">Draft</option>
              <option value="submitted">Submitted</option>
              <option value="acknowledged">Acknowledged</option>
            </select>
            <button
              type="button"
              onClick={() => {
                setNewReview(true);
                setSelectedId(null);
              }}
              className="rounded-md bg-slate-800 px-2 py-1.5 text-xs font-medium text-sky-300 ring-1 ring-slate-700 hover:bg-slate-700"
            >
              New review
            </button>
          </div>
          <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto">
            {filtered.map((card) => (
              <li key={card.scorecardId}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(card.scorecardId);
                    setNewReview(false);
                  }}
                  className={`w-full rounded-md px-2 py-2 text-left text-xs ring-1 transition ${
                    selectedId === card.scorecardId
                      ? "bg-slate-800 ring-slate-600"
                      : "bg-slate-900/40 ring-slate-800 hover:bg-slate-900"
                  }`}
                >
                  <div className="flex justify-between gap-2">
                    <span className="font-mono text-slate-300">{card.dispatcherId}</span>
                    <span className="text-slate-400">{card.overallScore.toFixed(0)}</span>
                  </div>
                  <p className="mt-0.5 text-[10px] text-slate-500">
                    {card.status} · {new Date(card.updatedAt).toLocaleString()}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="min-h-0 overflow-y-auto rounded-lg border border-slate-700/60 bg-slate-950/80 p-4">
          {newReview ? (
            <>
              <SectionHead title="New scorecard" />
              <div className="mb-3 grid gap-2 sm:grid-cols-2">
                <label className="text-xs text-slate-400">
                  Incident id
                  <input
                    value={newIncidentId}
                    onChange={(e) => setNewIncidentId(e.target.value)}
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
                  />
                </label>
                <label className="text-xs text-slate-400">
                  Dispatcher id
                  <input
                    value={newDispatcherId}
                    onChange={(e) => setNewDispatcherId(e.target.value)}
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
                  />
                </label>
              </div>
              <ScorecardForm
                busy={busy}
                onSaveDraft={(p) => void createScorecard(p, "draft")}
                onSubmit={(p) => void createScorecard(p, "submitted")}
              />
            </>
          ) : selected ? (
            <>
              <SectionHead title="Scorecard detail" />
              <div className="mb-4 space-y-0 rounded border border-slate-800 bg-slate-900/40 px-3">
                <DataRow label="Scorecard" value={<span className="font-mono">{selected.scorecardId}</span>} />
                <DataRow label="Status" value={selected.status} />
                <DataRow label="Dispatcher" value={<span className="font-mono">{selected.dispatcherId}</span>} />
                <DataRow label="Incident" value={<span className="font-mono">{selected.incidentId}</span>} />
                <DataRow label="Overall" value={`${selected.overallScore.toFixed(1)} / 100`} />
              </div>
              <ScorecardForm
                initialItems={selected.items}
                initialCoachingNotes={selected.coachingNotes}
                initialFollowUp={selected.followUpRequired}
                readOnly={selected.status === "acknowledged"}
                busy={busy}
                onSaveDraft={(p) => void updateSelected(p, "draft")}
                onSubmit={(p) => void updateSelected(p, "submitted")}
              />
              <div className="mt-6 border-t border-slate-800 pt-4">
                <SectionHead title="Coaching notes" />
                <div className="space-y-2">
                  {(coachingQuery.data ?? []).map((note) => (
                    <CoachingNoteCard key={note.noteId} note={note} />
                  ))}
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    const content = window.prompt("Coaching note");
                    if (content?.trim()) void addCoachingNote(content.trim());
                  }}
                  className="mt-2 rounded-md border border-slate-600 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-40"
                >
                  Add coaching note
                </button>
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-500">Select a scorecard or start a new review.</p>
          )}
        </section>
      </div>
    </div>
  );
}
