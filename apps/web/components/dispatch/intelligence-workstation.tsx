"use client";

import { useState } from "react";
import type { AIAnalysis, ConfidenceAnalysis, Incident } from "rapid-cortex-shared";
import { IntelligencePanelContent } from "@/components/dispatch/ai-panel";
import { Ng911AssistPanel } from "@/components/dispatch/ng911-assist-panel";
import { SopProtocolSurface } from "@/components/dispatch/sop-protocol-surface";
import { ConfidencePanel } from "@/components/confidence/confidence-panel";
import { isFieldConfidenceEnabled, isNg911AssistEnabled } from "@/lib/runtime-flags";

const TABS = ["SUMMARY", "PROTOCOL", "RATIONALE", "NG911 DATA"] as const;
type Tab = (typeof TABS)[number];

export function IntelligenceWorkstation({
  incidentId,
  incident,
  analysis,
  fieldConfidence = null,
  fieldConfidenceLoading = false,
  analysisError = null,
  analysisLoading = false,
  isRefreshingAi = false,
  onRefreshAi,
}: {
  incidentId: string | null;
  incident: Incident | null;
  analysis: AIAnalysis | null;
  fieldConfidence?: ConfidenceAnalysis | null;
  fieldConfidenceLoading?: boolean;
  analysisError?: string | null;
  analysisLoading?: boolean;
  isRefreshingAi?: boolean;
  onRefreshAi?: () => void;
}) {
  const [tab, setTab] = useState<Tab>("SUMMARY");
  const fieldOn = isFieldConfidenceEnabled();
  const showFields = fieldOn && (fieldConfidence != null || fieldConfidenceLoading);
  const pct =
    fieldConfidence?.aggregate.overallScore != null
      ? Math.round(fieldConfidence.aggregate.overallScore * 100)
      : analysis
        ? Math.round(analysis.confidence * 100)
        : 0;
  const picture = fieldConfidence?.aggregate.pictureStatus ?? "INCOMPLETE";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] text-[var(--rc-purple)]">
          {pct}% · {picture}
        </span>
        {onRefreshAi ? (
          <button
            type="button"
            onClick={onRefreshAi}
            disabled={isRefreshingAi}
            className="ws-toolbar-btn h-6 px-2 text-[10px]"
          >
            {isRefreshingAi ? "…" : "Re-run"}
          </button>
        ) : null}
      </div>

      {showFields && incidentId ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ConfidencePanel
            analysis={fieldConfidence}
            isAnalyzing={fieldConfidenceLoading && !fieldConfidence}
          />
        </div>
      ) : analysis?.nextQuestion ? (
        <p className="mb-2 text-[12px] text-[var(--rc-text)]">
          <span className="mr-1 text-[10px] font-bold uppercase tracking-wide text-[var(--rc-purple)]">
            Next
          </span>
          {analysis.nextQuestion}
        </p>
      ) : null}

      <div className="mt-1 flex shrink-0 gap-0 border-b border-[var(--rc-border)]">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide"
            style={{
              color: tab === t ? "var(--rc-purple)" : "var(--rc-text-muted)",
              borderBottom: tab === t ? "2px solid var(--rc-purple)" : "2px solid transparent",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pt-1">
        {tab === "SUMMARY" ? (
          <IntelligencePanelContent
            incidentId={incidentId}
            incident={incident}
            analysis={analysis}
            fieldConfidence={null}
            fieldConfidenceLoading={false}
            analysisError={analysisError}
            analysisLoading={analysisLoading}
            onRefresh={undefined}
            isRefreshing={false}
            variant="workstation-summary"
          />
        ) : null}
        {tab === "PROTOCOL" ? (
          incidentId && incident ? (
            <SopProtocolSurface incidentId={incidentId} incident={incident} />
          ) : (
            <p className="text-[12px] text-[var(--rc-text-muted)]">Select an incident.</p>
          )
        ) : null}
        {tab === "RATIONALE" ? (
          <p className="whitespace-pre-wrap text-[12px] leading-snug text-[var(--rc-text)]">
            {analysis?.rationale?.trim() || "No rationale yet."}
          </p>
        ) : null}
        {tab === "NG911 DATA" ? (
          isNg911AssistEnabled() ? (
            <Ng911AssistPanel incidentId={incidentId} />
          ) : (
            <p className="text-[12px] text-[var(--rc-text-muted)]">NG9-1-1 assist is not enabled.</p>
          )
        ) : null}
      </div>
    </div>
  );
}
