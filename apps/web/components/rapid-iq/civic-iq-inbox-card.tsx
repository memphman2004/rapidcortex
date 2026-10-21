"use client";

import type { NexiqSignalRecord } from "rapid-cortex-shared";
import { formatCurrency, formatShortDate, intentFitBadgeClass } from "@/lib/rapid-iq/scoring";
import { VERTICAL_BORDER } from "./opportunity-card";
import type { FeedTab } from "./vertical-tabs";

const VERTICAL_LABEL: Record<NexiqSignalRecord["vertical"], string> = {
  core_psap: "911",
  campus: "CAMPUS",
  venue: "VENUE",
  transit: "TRANSIT",
};

const TIER_STYLES: Record<string, string> = {
  high: "bg-amber-500/20 text-amber-200 border border-amber-500/40",
  medium: "bg-sky-500/15 text-sky-200 border border-sky-500/30",
  low: "bg-slate-500/20 text-slate-300 border border-slate-500/30",
};

type Props = {
  signal: NexiqSignalRecord;
  feedTab: FeedTab;
  busy?: boolean;
  onAction: (action: "track" | "dismiss" | "push_to_crm") => void;
};

export function CivicIqInboxCard({ signal, feedTab, busy = false, onAction }: Props) {
  const borderClass =
    feedTab === "competitor" ? "border-l-sky-500" : VERTICAL_BORDER[feedTab] ?? "border-l-sky-500";
  const state = signal.geography?.state;

  return (
    <article
      className={[
        "border-b border-slate-900/80 border-l-2 px-4 py-3",
        borderClass,
      ].join(" ")}
    >
      <div className="flex items-start gap-2.5">
        <div
          className={`flex h-9 w-11 shrink-0 flex-col items-center justify-center rounded-md border ${intentFitBadgeClass(signal.confidenceScore)}`}
          title={`Civic IQ confidence ${signal.confidenceScore}`}
        >
          <span className="text-[8px] font-bold uppercase leading-none tracking-wide opacity-80">IQ</span>
          <span className="text-sm font-bold leading-none">{signal.confidenceScore}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-bold text-slate-100">{signal.agencyName || signal.title}</span>
            {state ? <span className="text-sm text-slate-500">, {state}</span> : null}
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            <span
              className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                TIER_STYLES[signal.confidenceTier] ?? TIER_STYLES.low
              }`}
            >
              {signal.confidenceTier}
            </span>
            <span className="rounded-full border border-slate-600/40 bg-slate-700/50 px-2 py-0.5 text-[9px] font-bold text-slate-300">
              {VERTICAL_LABEL[signal.vertical]}
            </span>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[9px] font-bold text-emerald-300">
              NEW
            </span>
          </div>
        </div>
      </div>

      {signal.agencyName && signal.title && signal.title !== signal.agencyName ? (
        <div className="mt-2 text-xs font-semibold text-slate-200">{signal.title}</div>
      ) : null}
      {signal.summary ? (
        <div className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-400">{signal.summary}</div>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          className="signal-pipeline-btn"
          disabled={busy}
          onClick={() => onAction("track")}
        >
          {busy ? "…" : "Track"}
        </button>
        <button
          type="button"
          className="btn-dismiss"
          disabled={busy}
          onClick={() => onAction("dismiss")}
        >
          Dismiss
        </button>
        <button
          type="button"
          className="rounded border border-violet-500/40 px-2 py-1 text-[10px] font-medium text-violet-200 hover:bg-violet-500/10 disabled:opacity-50"
          disabled={busy}
          onClick={() => onAction("push_to_crm")}
        >
          Push to CRM
        </button>
        <span className="text-[10px] text-slate-600">{formatShortDate(signal.createdAt)}</span>
        {signal.estimatedValue != null && signal.estimatedValue > 0 ? (
          <span className="rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-300">
            {formatCurrency(signal.estimatedValue)}
          </span>
        ) : null}
        <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          civic iq
        </span>
      </div>
    </article>
  );
}
