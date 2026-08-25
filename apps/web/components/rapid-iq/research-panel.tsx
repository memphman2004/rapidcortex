"use client";

import { useState } from "react";
import type { RapidIqResearchResponse } from "rapid-cortex-shared";
import { runRapidIqResearch } from "@/lib/rapid-iq/pipeline-api";

export function RapidIqResearchPanel() {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RapidIqResearchResponse | null>(null);

  async function handleResearch() {
    const q = query.trim();
    if (q.length < 3 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const next = await runRapidIqResearch({ query: q });
      setResult(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Research failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="research-panel border-b border-[rgba(255,255,255,0.06)] bg-[#07101f] px-5 py-3">
      <div className="research-header flex items-baseline gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wide text-sky-300">AI Research</span>
        <span className="research-hint text-[10px] text-slate-500">
          Ask about agencies, signals, or opportunities — answers cite public-record sources only
        </span>
      </div>
      <div className="research-input-row mt-2 flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='e.g. "Which PSAPs in Georgia discussed NG911 in the last 90 days?"'
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleResearch();
          }}
          className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#080f1e] px-3 py-2 text-xs text-slate-200 placeholder-[#334155] outline-none focus:border-sky-500"
        />
        <button
          type="button"
          onClick={() => void handleResearch()}
          disabled={busy || query.trim().length < 3}
          className="shrink-0 rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
        >
          {busy ? "Searching…" : "Research"}
        </button>
      </div>
      {error && <p className="mt-2 text-[11px] text-red-300">{error}</p>}
      {result && (
        <div className="research-result mt-3 space-y-2">
          <div className="research-answer whitespace-pre-wrap text-xs leading-relaxed text-slate-200">
            {result.answer}
          </div>
          <div className="research-confidence text-[10px] text-slate-500">
            Confidence: {result.confidence}
            {result.mocked ? " · extractive summary (no model key)" : ""} · {result.disclaimer}
          </div>
          {result.citations && result.citations.length > 0 && (
            <div className="research-sources flex flex-col gap-1">
              {result.citations.slice(0, 8).map((c) => (
                <a
                  key={`${c.sourceUrl}-${c.title}`}
                  href={c.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate text-[11px] text-sky-400 hover:underline"
                >
                  {c.agencyName ? `${c.agencyName} — ` : ""}
                  {c.title}
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
