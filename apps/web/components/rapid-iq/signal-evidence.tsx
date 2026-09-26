"use client";

import { useState } from "react";
import type { RapidIqPipelineSignal } from "rapid-cortex-shared";
import { formatShortDate } from "@/lib/rapid-iq/scoring";

export function SignalEvidenceBlock({ signal }: { signal: RapidIqPipelineSignal }) {
  const excerpt = signal.excerpt || signal.summary || signal.rawSnippet;
  const evidenceLinks = signal.evidence ?? [];
  const activities = signal.activities ?? [];
  const [open, setOpen] = useState(Boolean(signal.excerpt) || Boolean(signal.watchUpdated));
  if (!excerpt && !signal.sourceUrl && evidenceLinks.length === 0 && activities.length === 0) {
    return null;
  }

  return (
    <div className="signal-evidence mt-2">
      <button
        type="button"
        className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-300"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        {open ? "Hide evidence" : "Show evidence"}
      </button>
      {open && (
        <div className="mt-1.5 rounded-md border border-slate-800 bg-slate-950/60 px-2.5 py-2">
          <div className="evidence-source flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
            {signal.sourceUrl ? (
              <a
                href={signal.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sky-400 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {signal.sourceDomain || signal.sourceTitle || "Source document"}
              </a>
            ) : (
              <span>{signal.sourceDomain || signal.sourceTitle}</span>
            )}
            {(signal.documentDate || signal.signalDate) && (
              <span>{formatShortDate(signal.documentDate || signal.signalDate)}</span>
            )}
          </div>
          {excerpt && (
            <blockquote className="evidence-excerpt mt-1.5 text-[11px] leading-relaxed text-slate-300">
              “{excerpt.slice(0, 500)}”
            </blockquote>
          )}
          {signal.pageLocation && (
            <div className="evidence-location mt-1 text-[10px] text-slate-500">{signal.pageLocation}</div>
          )}
          {evidenceLinks.length > 0 && (
            <ul className="mt-2 space-y-1 border-t border-slate-800 pt-2">
              {evidenceLinks.map((ev) => (
                <li key={ev.url} className="text-[10px] text-slate-400">
                  <span className="mr-1.5 uppercase tracking-wide text-slate-600">
                    {ev.sourceType.replace(/_/g, " ")}
                  </span>
                  <a
                    href={ev.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sky-400 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {ev.url.replace(/^https?:\/\//, "").slice(0, 72)}
                  </a>
                </li>
              ))}
            </ul>
          )}
          {activities.length > 0 && (
            <ul className="mt-2 space-y-1 border-t border-slate-800 pt-2">
              {activities.slice(0, 8).map((act, i) => (
                <li key={`${act.at}-${i}`} className="text-[10px] text-slate-400">
                  <span className="font-medium text-slate-300">
                    {formatShortDate(act.at)} — {act.changeType.replace(/_/g, " ")}
                  </span>
                  {act.summary ? `: ${act.summary}` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
