"use client";

import { filterSignalsForVertical, type SalesLeadCrmRecord } from "rapid-cortex-shared";
import { formatDateTime } from "./leads-utils";

const TYPE_LABEL: Record<string, string> = {
  GRANT_SIGNAL: "Grant",
  RFP_SIGNAL: "RFP",
  BUDGET_SIGNAL: "Budget",
  LEADERSHIP_CHANGE: "Leadership",
  GRANT_AWARD: "Grant award",
  HIRING_SIGNAL: "Hiring",
  CONFERENCE_SIGNAL: "Conference",
  COMPETITOR_MENTION: "Competitor",
  STALE_PIPELINE: "Stale",
};

export function LeadSignalsTab({ lead }: { lead: SalesLeadCrmRecord }) {
  const signals = filterSignalsForVertical(lead.signals, lead.vertical).sort(
    (a, b) => Date.parse(b.detectedAt) - Date.parse(a.detectedAt),
  );

  return (
    <div className="space-y-3 p-4">
      <p className="text-xs text-slate-500">
        Signals for vertical{" "}
        <span className="font-semibold text-slate-300">{lead.vertical ?? "rc911"}</span> only —
        other verticals are never shown here.
      </p>
      {(lead.hotScore ?? 0) > 0 ? (
        <p className="text-xs text-slate-400">
          Hot score: <span className="font-semibold text-amber-300">{lead.hotScore}</span>
        </p>
      ) : null}
      {signals.length === 0 ? (
        <p className="text-sm text-slate-500">No signals yet for this vertical.</p>
      ) : (
        signals.map((s) => (
          <article
            key={s.signalId}
            className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-300">
                {TYPE_LABEL[s.type] ?? s.type}
              </span>
              <span className="text-[10px] uppercase tracking-wide text-slate-500">{s.strength}</span>
              <span className="ml-auto text-[10px] text-slate-600">
                {formatDateTime(s.detectedAt)}
              </span>
            </div>
            <h3 className="mt-2 text-sm font-semibold text-white">{s.title}</h3>
            <p className="mt-1 text-xs text-slate-400">{s.summary}</p>
            {s.sourceUrl ? (
              <a
                href={s.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-xs text-sky-400 hover:underline"
              >
                Source
              </a>
            ) : null}
          </article>
        ))
      )}
    </div>
  );
}
