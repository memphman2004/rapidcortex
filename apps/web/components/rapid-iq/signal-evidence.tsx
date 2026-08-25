"use client";

import { useState } from "react";
import type { RapidIqPipelineSignal } from "rapid-cortex-shared";
import { formatShortDate } from "@/lib/rapid-iq/scoring";

export function SignalEvidenceBlock({ signal }: { signal: RapidIqPipelineSignal }) {
  const excerpt = signal.excerpt || signal.summary || signal.rawSnippet;
  const [open, setOpen] = useState(Boolean(signal.excerpt));
  if (!excerpt && !signal.sourceUrl) return null;

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
        </div>
      )}
    </div>
  );
}
