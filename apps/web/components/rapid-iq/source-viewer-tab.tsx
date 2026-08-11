"use client";

import { useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import type { RapidIqSource } from "@/lib/rapid-iq/types";

const SOURCE_ROLE_LABELS: Record<string, string> = {
  primary: "Primary Source",
  supporting: "Supporting",
  procurement: "Procurement",
  budget: "Budget",
  contact: "Contact Source",
};

/** Collapse locale/tracking query variants of the same page into one tab. */
function normalizeSourceUrl(url: string): string {
  try {
    const u = new URL(url.trim());
    const dropExact = new Set(["oc_lang", "lang", "locale", "hl", "language"]);
    for (const key of [...u.searchParams.keys()]) {
      const lower = key.toLowerCase();
      if (dropExact.has(lower) || lower.startsWith("utm_")) {
        u.searchParams.delete(key);
      }
    }
    u.hash = "";
    if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
      u.pathname = u.pathname.slice(0, -1);
    }
    return u.toString().toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

function dedupeSources(sources: RapidIqSource[]): RapidIqSource[] {
  const byUrl = new Map<string, RapidIqSource>();
  for (const s of sources) {
    const key = normalizeSourceUrl(s.url);
    const existing = byUrl.get(key);
    if (!existing) {
      byUrl.set(key, s);
      continue;
    }
    if (s.sourceRole === "primary" && existing.sourceRole !== "primary") {
      byUrl.set(key, s);
    }
  }
  return [...byUrl.values()];
}

type Props = {
  sources: RapidIqSource[];
};

export function SourceViewerTab({ sources }: Props) {
  const uniqueSources = useMemo(() => dedupeSources(sources), [sources]);
  const [activeId, setActiveId] = useState(uniqueSources[0]?.sourceId ?? null);
  const active =
    uniqueSources.find((s) => s.sourceId === activeId) ?? uniqueSources[0];

  if (uniqueSources.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-sm text-slate-600">
        No source documents linked to this opportunity.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {uniqueSources.length > 1 && (
        <div className="flex gap-1 overflow-x-auto border-b border-slate-800 px-4 py-2">
          {uniqueSources.map((s) => (
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
              {SOURCE_ROLE_LABELS[s.sourceRole] ?? s.sourceRole}
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
                  {SOURCE_ROLE_LABELS[active.sourceRole] ?? active.sourceRole} SOURCE
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
