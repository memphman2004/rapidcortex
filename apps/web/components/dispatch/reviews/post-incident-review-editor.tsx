"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isSupervisorOrAdmin } from "rapid-cortex-security";
import type { PostIncidentReview, ReviewSection } from "rapid-cortex-shared";
import { useSession } from "@/components/auth/session-context";
import { useJurisdictionLink } from "@/lib/jurisdiction-context";
import { fetchQaScorecards } from "@/lib/qa-module-api";
import { fetchIncidentTimeline } from "@/lib/incident-timeline-api";
import {
  downloadReviewExport,
  exportPostIncidentReview,
  fetchPostIncidentReview,
  isPostIncidentReviewApiConfigured,
  patchPostIncidentReview,
} from "@/lib/post-incident-review-api";
import { isPostIncidentReviewsEnabled, isQaScoringEnabled } from "@/lib/runtime-flags";

export function PostIncidentReviewEditor({ reviewId }: { reviewId: string }) {
  const { user } = useSession();
  const qc = useQueryClient();
  const to = useJurisdictionLink();
  const [sections, setSections] = useState<ReviewSection[]>([]);
  const [linkedScorecards, setLinkedScorecards] = useState<string[]>([]);
  const [linkedTimeline, setLinkedTimeline] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const enabled = isPostIncidentReviewsEnabled() && isPostIncidentReviewApiConfigured();
  const canEdit = user ? isSupervisorOrAdmin(user.role) : false;

  const reviewQuery = useQuery({
    queryKey: ["post-incident-review", reviewId],
    queryFn: () => fetchPostIncidentReview(reviewId),
    enabled,
  });

  const review = reviewQuery.data;
  const readOnly = !canEdit || review?.status !== "draft";

  useEffect(() => {
    if (!review) return;
    setSections(review.sections);
    setLinkedScorecards(review.linkedScorecardIds);
    setLinkedTimeline(review.linkedTimelineEventIds);
    setHydrated(true);
  }, [review]);

  const scorecardsQuery = useQuery({
    queryKey: ["qa-scorecards", review?.incidentId],
    queryFn: () => fetchQaScorecards({ incidentId: review!.incidentId }),
    enabled: Boolean(review?.incidentId) && isQaScoringEnabled(),
  });

  const timelineQuery = useQuery({
    queryKey: ["incident-timeline", review?.incidentId],
    queryFn: () => fetchIncidentTimeline(review!.incidentId),
    enabled: Boolean(review?.incidentId),
  });

  const scorecardOptions = useMemo(() => scorecardsQuery.data ?? [], [scorecardsQuery.data]);
  const timelineEvents = useMemo(() => timelineQuery.data ?? [], [timelineQuery.data]);

  const updateSection = (sectionId: string, content: string) => {
    setSections((prev) => prev.map((s) => (s.sectionId === sectionId ? { ...s, content } : s)));
  };

  const toggleTimeline = (eventId: string) => {
    setLinkedTimeline((prev) =>
      prev.includes(eventId) ? prev.filter((id) => id !== eventId) : [...prev, eventId],
    );
  };

  const save = async (finalize: boolean) => {
    if (!review) return;
    setBusy(true);
    setError(null);
    try {
      await patchPostIncidentReview(reviewId, {
        sections,
        linkedScorecardIds: linkedScorecards,
        linkedTimelineEventIds: linkedTimeline,
        status: finalize ? "final" : "draft",
      });
      await qc.invalidateQueries({ queryKey: ["post-incident-review", reviewId] });
      await qc.invalidateQueries({ queryKey: ["post-incident-reviews"] });
      if (finalize) setHydrated(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const onExport = async () => {
    try {
      const data = await exportPostIncidentReview(reviewId);
      downloadReviewExport(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    }
  };

  if (!enabled) {
    return <p className="p-6 text-sm text-slate-500">Post-incident reviews are disabled.</p>;
  }

  if (reviewQuery.isLoading) {
    return <p className="p-6 text-sm text-slate-500">Loading review…</p>;
  }

  if (!review) {
    return <p className="p-6 text-sm text-rose-300">Review not found.</p>;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={to("/reviews")} className="text-xs text-sky-400 hover:underline">
            ← All reviews
          </Link>
          <h1 className="mt-1 text-lg font-semibold text-white">Post-incident review</h1>
          <p className="font-mono text-xs text-slate-500">
            {review.incidentId} · {review.status}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!readOnly ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => void save(false)}
                className="rounded bg-slate-800 px-3 py-1.5 text-xs text-sky-200 ring-1 ring-slate-600 disabled:opacity-40"
              >
                Save draft
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void save(true)}
                className="rounded bg-emerald-950/80 px-3 py-1.5 text-xs text-emerald-100 ring-1 ring-emerald-800 disabled:opacity-40"
              >
                Finalize
              </button>
            </>
          ) : null}
          {review.status === "final" || review.status === "archived" ? (
            <button
              type="button"
              onClick={() => void onExport()}
              className="rounded border border-slate-600 px-3 py-1.5 text-xs text-slate-200"
            >
              Export JSON
            </button>
          ) : null}
        </div>
      </div>

      {error ? <p className="text-xs text-rose-300">{error}</p> : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {sections.map((s) => (
            <section key={s.sectionId} className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
              <h2 className="text-sm font-medium text-white">{s.title}</h2>
              <textarea
                value={s.content}
                disabled={readOnly}
                onChange={(e) => updateSection(s.sectionId, e.target.value)}
                rows={5}
                className="mt-2 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100 disabled:opacity-70"
              />
            </section>
          ))}
        </div>

        <aside className="space-y-4">
          <section className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
            <h3 className="text-xs font-semibold uppercase text-slate-500">Linked scorecards</h3>
            {isQaScoringEnabled() ? (
              <select
                disabled={readOnly}
                value=""
                onChange={(e) => {
                  const id = e.target.value;
                  if (id && !linkedScorecards.includes(id)) {
                    setLinkedScorecards((p) => [...p, id]);
                  }
                }}
                className="mt-2 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
              >
                <option value="">Add scorecard…</option>
                {scorecardOptions.map((sc) => (
                  <option key={sc.scorecardId} value={sc.scorecardId}>
                    {sc.scorecardId} · {sc.overallScore}
                  </option>
                ))}
              </select>
            ) : (
              <p className="mt-2 text-xs text-slate-500">QA module disabled.</p>
            )}
            <ul className="mt-2 space-y-1 text-xs text-slate-400">
              {linkedScorecards.map((id) => (
                <li key={id} className="flex justify-between gap-2 font-mono">
                  {id}
                  {!readOnly ? (
                    <button type="button" onClick={() => setLinkedScorecards((p) => p.filter((x) => x !== id))}>
                      ×
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
            <h3 className="text-xs font-semibold uppercase text-slate-500">Timeline references</h3>
            <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto text-xs">
              {timelineEvents.map((ev) => (
                <li key={ev.eventId} className="flex gap-2 text-slate-300">
                  <input
                    type="checkbox"
                    disabled={readOnly}
                    checked={linkedTimeline.includes(ev.eventId)}
                    onChange={() => toggleTimeline(ev.eventId)}
                  />
                  <span>
                    <span className="text-slate-500">{new Date(ev.timestamp).toLocaleString()}</span>
                    <br />
                    {ev.kind.replace(/_/g, " ")}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
