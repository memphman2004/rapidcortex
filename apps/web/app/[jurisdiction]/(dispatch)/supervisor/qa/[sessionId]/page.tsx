"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { BarChart2 } from "lucide-react";
import { useSession } from "@/components/auth/session-context";
import { QaCoachingCard } from "@/components/dispatch/qa/qa-coaching-card";
import { QaScorecard } from "@/components/dispatch/qa/qa-scorecard";
import { QaStatusBadge } from "@/components/dispatch/qa/qa-status-badge";
import { QaSupervisorNotes } from "@/components/dispatch/qa/qa-supervisor-notes";
import { fetchQaSession, fetchTranscript, isApiConfigured, patchQaSession, postQaSessionScore } from "@/lib/api";
import { useJurisdictionLink } from "@/lib/jurisdiction-context";
import { isQaScoringEnabled } from "@/lib/runtime-flags";
import { isSupervisorOrAdmin } from "@/lib/auth/roles";
import type { QASession } from "rapid-cortex-shared";
import { isSupervisorOrStaffRole, SupervisorAccessRestricted } from "../../_components/supervisor-access";

export default function SupervisorQaSessionDetailPage() {
  const params = useParams();
  const raw = params.sessionId;
  const sessionId = typeof raw === "string" ? decodeURIComponent(raw) : "";
  const to = useJurisdictionLink();
  const qc = useQueryClient();
  const { user } = useSession();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["qa-session", sessionId],
    queryFn: () => fetchQaSession(sessionId),
    enabled: Boolean(sessionId) && isQaScoringEnabled() && isApiConfigured(),
  });

  const transcriptQuery = useQuery({
    queryKey: ["transcript", q.data?.incidentId],
    queryFn: () => fetchTranscript(q.data!.incidentId),
    enabled: Boolean(q.data?.incidentId) && isApiConfigured(),
  });

  const canSupervise = useMemo(
    () => user && isSupervisorOrAdmin(user.role),
    [user],
  );

  if (!isSupervisorOrStaffRole(user?.role)) {
    return <SupervisorAccessRestricted />;
  }

  const runScore = async () => {
    if (!sessionId) return;
    setBusy(true);
    setErr(null);
    try {
      await postQaSessionScore(sessionId);
      await qc.invalidateQueries({ queryKey: ["qa-session", sessionId] });
      await qc.invalidateQueries({ queryKey: ["qa-sessions"] });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Scoring failed");
    } finally {
      setBusy(false);
    }
  };

  const markReviewed = async (s: QASession) => {
    setBusy(true);
    setErr(null);
    try {
      await patchQaSession(s.sessionId, { status: "reviewed" });
      await qc.invalidateQueries({ queryKey: ["qa-session", sessionId] });
      await qc.invalidateQueries({ queryKey: ["qa-sessions"] });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  if (!isQaScoringEnabled()) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <BarChart2 className="mb-4 h-10 w-10 text-slate-600" />
        <h2 className="text-lg font-semibold text-slate-300">QA Scoring</h2>
        <p className="mt-2 max-w-sm text-sm text-slate-500">
          QA scoring is not enabled for this agency configuration. Contact your administrator to enable this feature.
        </p>
      </div>
    );
  }

  if (!isApiConfigured()) {
    return <div className="p-6 text-sm text-slate-400">Configure the API to load this session.</div>;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 pb-10">
      <div className="flex flex-wrap items-center gap-3">
        <Link href={to("/supervisor/qa")} className="text-xs font-medium text-sky-400 hover:text-sky-300">
          ← QA queue
        </Link>
      </div>
      {q.isLoading ? <p className="text-sm text-slate-500">Loading…</p> : null}
      {q.isError ? (
        <p className="text-sm text-rose-300" role="alert">
          {q.error instanceof Error ? q.error.message : "Failed to load session"}
        </p>
      ) : null}
      {err ? (
        <p className="text-sm text-rose-300" role="alert">
          {err}
        </p>
      ) : null}
      {q.data ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-white">QA session</h1>
              <p className="mt-1 font-mono text-xs text-slate-500">{q.data.sessionId}</p>
            </div>
            <QaStatusBadge status={q.data.status} />
          </div>
          <p className="text-sm text-slate-400">
            Incident <span className="font-mono text-slate-300">{q.data.incidentId}</span> · Dispatcher{" "}
            <span className="font-mono text-slate-300">{q.data.dispatcherUserId}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {(q.data.status === "draft" || q.data.status === "failed") && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void runScore()}
                className="rounded-md bg-teal-950/80 px-3 py-1.5 text-xs font-medium text-teal-100 ring-1 ring-teal-800 hover:bg-teal-900/80 disabled:opacity-40"
              >
                {busy ? "Working…" : "Run AI scoring"}
              </button>
            )}
            {canSupervise && q.data.status === "scored" ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void markReviewed(q.data)}
                className="rounded-md bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-100 ring-1 ring-slate-700 hover:bg-slate-700 disabled:opacity-40"
              >
                Mark reviewed
              </button>
            ) : null}
          </div>
          {q.data.status === "scored" || q.data.status === "reviewed" ? (
            <>
              <QaScorecard session={q.data} transcriptPreview={transcriptQuery.data ?? []} />
              <QaCoachingCard session={q.data} />
            </>
          ) : null}
          {canSupervise ? (
            <QaSupervisorNotes
              session={q.data}
              onSaved={(next) => {
                qc.setQueryData(["qa-session", sessionId], next);
              }}
            />
          ) : (
            <QaSupervisorNotes session={q.data} readOnly />
          )}
        </div>
      ) : null}
    </div>
  );
}
