"use client";

import type { AIAnalysis, ConfidenceAnalysis, Incident, ProtocolGuidance } from "rapid-cortex-shared";
import { AiRecommendationCard } from "@/components/dispatch/ai-recommendation-card";
import { CategoryBadge, UrgencyBadge } from "@/components/dispatch/badges";
import { ConfidenceMeter } from "@/components/dispatch/confidence-meter";
import { ConfidencePanel } from "@/components/confidence/confidence-panel";
import { DispatchActionPanel } from "@/components/dispatch/dispatch-action-panel";
import { SummaryCard } from "@/components/dispatch/summary-card";
import { SilentTextPanel } from "@/components/dispatch/silent-text-panel";
import { PinpointPanel } from "@/components/dispatch/pinpoint-panel";
import { SurgePanel } from "@/components/dispatch/surge-panel";
import { VideoAssistPanel } from "@/components/dispatch/video-assist-panel";
import { LiveVideoPanel } from "@/components/dispatch/live-video-panel";
import { DashboardQaPanel } from "@/components/dispatch/qa/dashboard-qa-panel";
import { IncidentMediaPanel } from "@/components/dispatch/incident-media-panel";
import { SopProtocolSurface } from "@/components/dispatch/sop-protocol-surface";
import { NonEmergencyTriageStrip } from "@/components/dispatch/non-emergency-triage-strip";
import { isFieldConfidenceEnabled, isLiveVideoEnabled, isPinpointEnabled, isSilentTextEnabled } from "@/lib/runtime-flags";

export function AiRecommendationPanel({
  incidentId,
  incident,
  analysis,
  fieldConfidence = null,
  fieldConfidenceLoading = false,
  analysisLoading = false,
  analysisError = null,
  onRefresh,
  isRefreshing,
  assistiveLabel = "AI recommendations (assistive)",
  className,
  showCadSuggestedBadge = false,
}: {
  incidentId: string | null;
  incident: Incident | null;
  analysis: AIAnalysis | null;
  /** Latest per-field confidence analysis (when ENABLE_FIELD_CONFIDENCE is on). */
  fieldConfidence?: ConfidenceAnalysis | null;
  fieldConfidenceLoading?: boolean;
  /** True while fetching analysis for the current `incidentId` (or cache not yet aligned). */
  analysisLoading?: boolean;
  /** Shown when the last analyze call failed (pilot: surfaces API error codes). */
  analysisError?: string | null;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  assistiveLabel?: string;
  /** Merged onto root `<aside>` (e.g. CAD workbench width). */
  className?: string;
  /** When true, show an “AI SUGGESTED” pill near the intelligence header (CAD workbench). */
  showCadSuggestedBadge?: boolean;
}) {
  const liveVideoEnabled = isLiveVideoEnabled();
  const silentTextEnabled = isSilentTextEnabled();
  const pinpointEnabled = isPinpointEnabled();
  const fieldConfidenceEnabled = isFieldConfidenceEnabled();
  const showFieldConfidence =
    fieldConfidenceEnabled && (fieldConfidence != null || fieldConfidenceLoading);
  return (
    <aside className={`flex w-80 shrink-0 flex-col bg-slate-900/30 ${className ?? ""}`.trim()}>
      <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2
            className="text-xs font-semibold uppercase tracking-wider text-slate-500"
            title="Structured AI triage for this incident. Suggestions only — follow agency SOP and dispatcher judgment."
          >
            Intelligence
          </h2>
          {showCadSuggestedBadge ? (
            <span className="rounded border border-amber-500/50 bg-amber-500/15 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wide text-amber-200">
              AI suggested
            </span>
          ) : null}
        </div>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="rounded-md bg-slate-800 px-2 py-1 text-xs font-medium text-sky-300 ring-1 ring-slate-700 hover:bg-slate-700 disabled:opacity-50"
          >
            {isRefreshing ? "…" : "Refresh AI"}
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <p className="mb-3 text-[11px] leading-snug text-slate-500">{assistiveLabel}</p>
        {incidentId ? (
          <p className="mb-2 font-mono text-[10px] text-slate-500">
            Incident <span className="text-slate-400">{incidentId}</span>
          </p>
        ) : null}
        {analysisError ? (
          <div
            className="mb-3 rounded-md border border-rose-900/60 bg-rose-950/40 px-3 py-2 text-xs text-rose-100"
            role="alert"
          >
            {analysisError}
          </div>
        ) : null}
        {incidentId && incident ? (
          <div className="mb-4 flex flex-col gap-3">
            <SopProtocolSurface incidentId={incidentId} incident={incident} />
            <NonEmergencyTriageStrip incidentId={incidentId} />
          </div>
        ) : null}
        {showFieldConfidence && incidentId ? (
          <div className="mb-4">
            <ConfidencePanel
              analysis={fieldConfidence}
              isAnalyzing={fieldConfidenceLoading && !fieldConfidence}
              compact
            />
          </div>
        ) : null}
        {analysisLoading ? (
          <p className="text-sm text-slate-400">Loading intelligence for this incident…</p>
        ) : !incidentId ? (
          <p className="text-sm text-slate-500">Select an incident in the queue.</p>
        ) : !analysis && !showFieldConfidence ? (
          <p className="text-sm text-slate-500">
            No analysis yet for this incident. Use <span className="font-medium text-slate-400">Refresh AI</span> when
            the API is available.
          </p>
        ) : !analysis ? null : (
          <div className="flex flex-col gap-4">
            {analysis.protocolGuidance ? (
              <ProtocolCoachBlock guidance={analysis.protocolGuidance} />
            ) : null}
            <div className="flex flex-wrap gap-2">
              <CategoryBadge value={analysis.category} />
              <UrgencyBadge value={analysis.urgency} />
              {analysis.escalationFlag && (
                <span className="rounded bg-red-950 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-300 ring-1 ring-red-800">
                  Escalation
                </span>
              )}
              {incident?.dispatcherReviewAcknowledgedAt ? (
                <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-300 ring-1 ring-slate-600">
                  Reviewed
                </span>
              ) : null}
            </div>
            {!showFieldConfidence ? <ConfidenceMeter value01={analysis.confidence} /> : null}
            {!showFieldConfidence || !fieldConfidence?.aggregate.topSuggestedQuestion ? (
              <AiRecommendationCard text={analysis.nextQuestion} />
            ) : null}
            <Block label="Recommended action" value={analysis.recommendedAction} />
            <SummaryCard summary={analysis.summary} />
            <Block label="Rationale" value={analysis.rationale} muted />
            <div className="border-t border-slate-800 pt-2 text-[11px] text-slate-500">
              Provider: {analysis.provider} · {new Date(analysis.createdAt).toLocaleString()}
            </div>
          </div>
        )}
        <div className="mt-4">
          <DispatchActionPanel
            incidentId={incidentId}
            incident={incident}
            analysis={analysis}
            disabled={analysisLoading}
          />
        </div>
        <div className="mt-4 border-t border-slate-800 pt-3">
          {liveVideoEnabled ? <LiveVideoPanel incidentId={incidentId} /> : <VideoAssistPanel incidentId={incidentId} />}
        </div>
        {silentTextEnabled ? (
          <div className="mt-4 border-t border-slate-800 pt-3">
            <SilentTextPanel incidentId={incidentId} />
          </div>
        ) : null}
        {pinpointEnabled ? (
          <div className="mt-4 border-t border-slate-800 pt-3">
            <PinpointPanel incidentId={incidentId} />
          </div>
        ) : null}
        <div className="mt-4 border-t border-slate-800 pt-3">
          <SurgePanel incidentId={incidentId} />
        </div>
        <div className="mt-4 border-t border-slate-800 pt-3">
          <DashboardQaPanel incidentId={incidentId} disabled={analysisLoading} />
        </div>
        <div className="mt-4 border-t border-slate-800 pt-3">
          <IncidentMediaPanel incidentId={incidentId} />
        </div>
      </div>
      <UtilitySlot />
    </aside>
  );
}

function ProtocolCoachBlock({ guidance }: { guidance: ProtocolGuidance }) {
  return (
    <div className="rounded-lg border border-teal-900/50 bg-teal-950/25 p-3 shadow-inner shadow-teal-950/20">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-teal-300/90">
        Protocol coach
      </div>
      <h3 className="mt-1 text-sm font-semibold leading-snug text-teal-50">{guidance.protocolName}</h3>
      <p className="mt-1 font-mono text-[10px] text-teal-200/70">
        {guidance.protocolId} · {guidance.category}
      </p>
      <div className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        Current step
      </div>
      <p className="mt-0.5 text-xs text-slate-300">{guidance.currentStepTitle}</p>
      <div className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        Suggested phrase
      </div>
      <p className="mt-1 text-sm font-medium leading-relaxed text-teal-100">
        “{guidance.recommendedPhrase}”
      </p>
      <div className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        Why this step
      </div>
      <p className="mt-1 text-xs leading-relaxed text-slate-400">{guidance.rationale}</p>
      <div className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-amber-300/90">
        Escalation criteria
      </div>
      <p className="mt-1 text-xs leading-relaxed text-amber-100/90">{guidance.escalationCriteria}</p>
      <p className="mt-3 border-t border-teal-900/40 pt-2 text-[10px] leading-snug text-slate-500">
        {guidance.coachDisclaimer}
      </p>
    </div>
  );
}

function Block({
  label,
  value,
  accent,
  muted,
}: {
  label: string;
  value: string;
  accent?: boolean;
  muted?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <p
        className={`mt-1 text-sm leading-snug ${
          accent ? "text-sky-200" : muted ? "text-slate-400" : "text-slate-200"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function UtilitySlot() {
  return (
    <div className="border-t border-slate-800 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        Session context
      </div>
      <dl className="mt-2 space-y-1 text-xs text-slate-500">
        <div className="flex justify-between gap-2">
          <dt>Caller location</dt>
          <dd className="text-slate-400">—</dd>
        </div>
        <div className="flex justify-between gap-2" title="Baseline pilot UI does not embed live CAD deep links">
          <dt>CAD link</dt>
          <dd className="text-slate-400">Not connected</dd>
        </div>
      </dl>
    </div>
  );
}
