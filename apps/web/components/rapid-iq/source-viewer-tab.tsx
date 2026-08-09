"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import type { RapidIqSource } from "@/lib/rapid-iq/types";

type Props = {
  sources: RapidIqSource[];
};

export function SourceViewerTab({ sources }: Props) {
  const [activeId, setActiveId] = useState(sources[0]?.sourceId ?? null);
  const active = sources.find((s) => s.sourceId === activeId) ?? sources[0];

  if (sources.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-sm text-slate-600">
        No source documents linked to this opportunity.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {sources.length > 1 && (
        <div className="flex gap-1 overflow-x-auto border-b border-slate-800 px-4 py-2">
          {sources.map((s) => (
            <button
              key={s.sourceId}
              type="button"
              onClick={() => setActiveId(s.sourceId)}
              className={[
                "shrink-0 rounded px-2.5 py-1 text-[10px] font-semibold transition-colors",
                activeId === s.sourceId
                  ? "border border-sky-500/30 bg-sky-500/15 text-sky-300"
                  : "text-slate-500 hover:text-slate-300",
              ].join(" ")}
            >
              {s.sourceRole.toUpperCase()}
            </button>
          ))}
        </div>
      )}
      {active && (
        <div className="flex-1 overflow-hidden">
          {active.docUrl ? (
            <iframe src={active.docUrl} className="h-full w-full border-0 bg-white" title={active.title} />
          ) : (
            <div className="p-4">
              <div className="rounded border border-slate-800 bg-slate-900/50 p-4">
                <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  {active.sourceRole.toUpperCase()} SOURCE
                </div>
                <div className="mb-1 text-sm font-semibold text-slate-200">{active.title}</div>
                {active.pageReference && (
                  <div className="mb-2 text-[11px] text-slate-500">{active.pageReference}</div>
                )}
                {active.excerpt && (
                  <div className="mb-3 border-l-2 border-slate-700 pl-3 text-[11px] italic text-slate-500">
                    &ldquo;{active.excerpt}&rdquo;
                  </div>
                )}
                <a
                  href={active.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded bg-sky-600 px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-sky-500"
                >
                  <ExternalLink size={11} /> View Original Source
                </a>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
