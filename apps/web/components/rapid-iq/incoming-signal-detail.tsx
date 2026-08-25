"use client";

import {
  displayPipelineScores,
  RAPID_IQ_PIPELINE_SOURCE_LABELS,
  type RapidIqPipelineSignal,
} from "rapid-cortex-shared";
import { DualScoreBadge } from "./dual-score-badge";
import { ProcurementStageBadge } from "./procurement-stage-badge";
import { SignalEvidenceBlock } from "./signal-evidence";

type Props = {
  signal: RapidIqPipelineSignal;
  busy?: boolean;
  onClose: () => void;
  onAddToPipeline: () => void;
  onDismiss: () => void;
};

export function IncomingSignalDetail({
  signal,
  busy = false,
  onClose,
  onAddToPipeline,
  onDismiss,
}: Props) {
  const sourceLabel = RAPID_IQ_PIPELINE_SOURCE_LABELS[signal.sourceId] ?? signal.sourceId;
  const scores = displayPipelineScores(signal);
  return (
    <div className="flex h-full w-full max-w-xl flex-col border-l border-[rgba(255,255,255,0.06)] bg-[#0a1628] p-4 lg:max-w-2xl">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <DualScoreBadge intent={scores.intent} fit={scores.fit} />
          <div>
            <p className="text-sm font-semibold text-slate-100">
              {signal.agencyName || signal.rawTitle}
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
              <span>
                {sourceLabel}
                {signal.state ? ` · ${signal.state}` : ""}
              </span>
              <ProcurementStageBadge signal={signal} />
              {signal.manualEntry && (
                <span className="rounded-full border border-slate-500/40 px-2 py-0.5 text-[9px] font-bold text-slate-300">
                  MANUAL ENTRY
                </span>
              )}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-600 hover:text-slate-400"
          aria-label="Close"
        >
          ×
        </button>
      </div>
      {signal.recommendedAction && (
        <p className="mt-3 rounded border border-sky-500/20 bg-sky-500/10 px-2 py-1.5 text-[11px] text-sky-200">
          Next: {signal.recommendedAction}
        </p>
      )}
      <p className="mt-4 flex-1 overflow-y-auto text-sm leading-relaxed text-slate-300">
        {signal.summary || signal.rawSnippet || signal.rawTitle}
      </p>
      <SignalEvidenceBlock signal={signal} />
      {signal.sourceUrl && (
        <a
          href={signal.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 truncate text-[11px] text-sky-400 hover:underline"
        >
          {signal.sourceUrl}
        </a>
      )}
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          className="signal-pipeline-btn"
          disabled={busy}
          onClick={onAddToPipeline}
        >
          {busy ? "Adding…" : "Send to Pipeline"}
        </button>
        <button type="button" className="btn-dismiss" disabled={busy} onClick={onDismiss}>
          Dismiss
        </button>
      </div>
    </div>
  );
}
