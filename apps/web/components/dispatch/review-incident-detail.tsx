"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { AiRecommendationPanel } from "@/components/dispatch/ai-panel";
import { CategoryBadge, StatusBadge, UrgencyBadge } from "@/components/dispatch/badges";
import { TranscriptPanel } from "@/components/dispatch/transcript-panel";
import { formatRelativeOpened } from "@/lib/format";
import { isApiConfigured } from "@/lib/api";
import { loadIncident, loadLatestAnalysis, loadTranscript } from "@/lib/queries";
import { useState } from "react";
import { QaReviewIncidentStrip } from "@/components/dispatch/qa/qa-review-incident-strip";
import { useJurisdictionLink } from "@/lib/jurisdiction-context";
import { isQaScoringEnabled } from "@/lib/runtime-flags";
import { CreateStakeholderPageButton } from "@/components/command/stakeholder-page-builder";
import { isStakeholderPagesEnabled } from "@/lib/runtime-flags";

export function ReviewIncidentDetail({ incidentId }: { incidentId: string }) {
  const to = useJurisdictionLink();
  const [autoScroll, setAutoScroll] = useState(true);

  const incidentQuery = useQuery({
    queryKey: ["incident", incidentId],
    queryFn: () => loadIncident(incidentId),
  });

  const transcriptQuery = useQuery({
    queryKey: ["transcript", incidentId],
    queryFn: () => loadTranscript(incidentId),
  });

  const analysisQuery = useQuery({
    queryKey: ["analysis", incidentId],
    queryFn: () => loadLatestAnalysis(incidentId),
  });

  const inc = incidentQuery.data;

  if (incidentQuery.isSuccess && !inc) {
    return (
      <div className="flex flex-col gap-3 p-6">
        <Link href={to("/review")} className="text-sm text-sky-400 hover:underline">
          ← Back to supervisor overview
        </Link>
        <p className="text-slate-400">Incident not found.</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-4 py-3">
        <div>
          <Link
            href={to("/review")}
            className="text-xs font-medium text-sky-400 hover:underline"
          >
            ← Back to supervisor overview
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="font-mono text-sm text-white">{incidentId}</h1>
            {inc && (
              <>
                <CategoryBadge value={inc.category} />
                <UrgencyBadge value={inc.urgency} />
                <StatusBadge value={inc.status} />
                <span className="text-xs text-slate-500">
                  Opened {formatRelativeOpened(inc.createdAt)}
                </span>
              </>
            )}
          </div>
          {inc && (
            <p className="mt-1 max-w-3xl text-sm text-slate-300">{inc.title}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isStakeholderPagesEnabled() ? <CreateStakeholderPageButton incidentId={incidentId} /> : null}
          <Link
            href={`${to("/dashboard")}?incident=${encodeURIComponent(incidentId)}`}
            className="rounded-md bg-slate-800 px-3 py-1.5 text-xs font-medium text-sky-300 ring-1 ring-slate-700 hover:bg-slate-700"
          >
            Open in dispatch board
          </Link>
        </div>
      </div>
      {isQaScoringEnabled() && isApiConfigured() ? (
        <QaReviewIncidentStrip incidentId={incidentId} transcript={transcriptQuery.data ?? []} />
      ) : null}
      <div className="flex min-h-0 flex-1">
        <TranscriptPanel
          segments={transcriptQuery.data ?? []}
          autoScroll={autoScroll}
          onAutoScrollChange={setAutoScroll}
          isStreaming={false}
          isLoading={transcriptQuery.isLoading}
        />
        <AiRecommendationPanel
          incidentId={incidentId}
          incident={inc ?? null}
          analysis={analysisQuery.data ?? null}
          assistiveLabel="Supervisor review — assistive AI output"
        />
      </div>
    </div>
  );
}
