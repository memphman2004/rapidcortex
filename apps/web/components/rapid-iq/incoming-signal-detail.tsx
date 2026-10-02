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
  onWatch?: () => void;
};

export function IncomingSignalDetail({
  signal,
  busy = false,
  onClose,
  onAddToPipeline,
  onDismiss,
  onWatch,
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
              {signal.buyingStage && (
                <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[9px] font-bold uppercase text-sky-300">
                  {signal.buyingStage.replace(/_/g, " ")}
                </span>
              )}
              {signal.signalStrength && (
                <span className="rounded-full border border-slate-500/40 px-2 py-0.5 text-[9px] font-bold uppercase text-slate-300">
                  {signal.signalStrength}
                </span>
              )}
              {signal.priorityBand && (
                <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold uppercase text-amber-200">
                  {signal.priorityBand}
                </span>
              )}
              {signal.watched && (
                <span className="rounded-full border border-fuchsia-500/40 bg-fuchsia-500/10 px-2 py-0.5 text-[9px] font-bold text-fuchsia-200">
                  WATCHING
                </span>
              )}
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

      {signal.priorityReasons && signal.priorityReasons.length > 0 && (
        <div className="mt-3 rounded border border-amber-500/20 bg-amber-500/5 px-2.5 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-amber-200/90">Why now</p>
          <ul className="mt-1 space-y-0.5">
            {signal.priorityReasons.map((r) => (
              <li key={r} className="text-[11px] text-slate-300">
                ✓ {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {signal.recommendedAction && (
        <p className="mt-3 rounded border border-sky-500/20 bg-sky-500/10 px-2 py-1.5 text-[11px] text-sky-200">
          Next: {signal.recommendedAction}
        </p>
      )}

      <p className="mt-4 text-sm leading-relaxed text-slate-300">
        {signal.summary || signal.rawSnippet || signal.rawTitle}
      </p>

      {(signal.facts?.length || signal.inferences?.length) && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {signal.facts && signal.facts.length > 0 && (
            <div className="rounded border border-slate-800 bg-slate-950/50 px-2.5 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-400/90">
                Facts
              </p>
              <ul className="mt-1 space-y-1">
                {signal.facts.map((f) => (
                  <li key={f} className="text-[11px] text-slate-300">
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {signal.inferences && signal.inferences.length > 0 && (
            <div className="rounded border border-slate-800 bg-slate-950/50 px-2.5 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-violet-300/90">
                Inferences
              </p>
              <ul className="mt-1 space-y-1">
                {signal.inferences.map((f) => (
                  <li key={f} className="text-[11px] text-slate-400">
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {signal.matchedCapabilities && signal.matchedCapabilities.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {signal.matchedCapabilities.map((c) => (
            <span
              key={c}
              className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] text-slate-400"
            >
              {c.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 flex-1 overflow-y-auto">
        <SignalEvidenceBlock signal={signal} />
      </div>

      {signal.sourceUrl && (
        <a
          href={signal.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 truncate text-[11px] text-sky-400 hover:underline"
        >
          {signal.sourceUrl}
        </a>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="signal-pipeline-btn"
          disabled={busy}
          onClick={onAddToPipeline}
        >
          {busy ? "Adding…" : "+ Pipeline"}
        </button>
        {onWatch && (
          <button
            type="button"
            className="rounded border border-fuchsia-500/40 bg-fuchsia-500/10 px-3 py-1.5 text-[11px] font-semibold text-fuchsia-200 hover:bg-fuchsia-500/20 disabled:opacity-50"
            disabled={busy || signal.watched}
            onClick={onWatch}
          >
            {signal.watched ? "Watching" : "Watch"}
          </button>
        )}
        <button type="button" className="btn-dismiss" disabled={busy} onClick={onDismiss}>
          Dismiss
        </button>
      </div>
    </div>
  );
}
