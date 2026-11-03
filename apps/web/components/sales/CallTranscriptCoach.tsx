"use client";

import { useMemo, useState } from "react";
import {
  SALES_CALL_COACH_MIN_TRANSCRIPT,
  type SalesCallCoachResult,
} from "rapid-cortex-shared";

type CategoryOpen = Record<string, boolean>;

function ScoreBar({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, (score / 10) * 100));
  return (
    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
      <div
        className="h-full rounded-full bg-sky-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function CallTranscriptCoach() {
  const [transcript, setTranscript] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SalesCallCoachResult | null>(null);
  const [open, setOpen] = useState<CategoryOpen>({});

  const canAnalyze = transcript.trim().length >= SALES_CALL_COACH_MIN_TRANSCRIPT;
  const chars = useMemo(() => transcript.length, [transcript]);

  async function analyze() {
    if (!canAnalyze || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/sales/analyze-transcript", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ transcript, vertical: "general" }),
      });
      const json: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof json === "object" &&
          json &&
          "error" in json &&
          typeof (json as { error: unknown }).error === "string"
            ? (json as { error: string }).error
            : `Analyze failed (${res.status})`;
        throw new Error(msg);
      }
      const payload =
        typeof json === "object" && json && "data" in json
          ? (json as { data: SalesCallCoachResult }).data
          : (json as SalesCallCoachResult);
      setResult(payload);
      const next: CategoryOpen = {};
      for (const c of payload.categories ?? []) next[c.id] = false;
      setOpen(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-white">Call Coach</h2>
        <p className="mt-0.5 text-xs text-slate-400">
          Paste a call transcript and analyze for structured coaching feedback
        </p>
      </div>

      <div className="rounded-xl border border-white/5 bg-[#0a1628] p-4">
        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          rows={10}
          placeholder="Paste a call transcript and click Analyze Call to get coaching feedback"
          className="w-full resize-y rounded-lg border border-white/10 bg-[#050c1a] px-3 py-2 text-sm leading-relaxed text-slate-200 outline-none focus:border-sky-500/50"
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] text-slate-500">{chars} chars</p>
          <button
            type="button"
            disabled={!canAnalyze || loading}
            onClick={() => void analyze()}
            className={[
              "rounded-full px-4 py-2 text-[11px] font-bold transition",
              canAnalyze && !loading
                ? "bg-sky-600 text-white hover:bg-sky-500"
                : "cursor-not-allowed bg-white/5 text-slate-600",
            ].join(" ")}
          >
            {loading ? "Analyzing…" : "Analyze Call"}
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
      </div>

      {result && (
        <div className="space-y-3">
          <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-sky-400">
                  Overall score
                </p>
                <p className="mt-1 text-3xl font-semibold text-white">
                  {result.overallScore.toFixed(1)}
                  <span className="ml-1 text-base font-normal text-slate-400">/ 10</span>
                </p>
              </div>
              {result.mock ? (
                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                  Fixture / mock
                </span>
              ) : null}
            </div>
            <p className="mt-3 text-sm text-slate-300">{result.verdict}</p>
          </div>

          <div className="space-y-2">
            {result.categories.map((cat) => {
              const isOpen = open[cat.id] ?? false;
              return (
                <div
                  key={cat.id}
                  className="rounded-xl border border-white/5 bg-[#0a1628]"
                >
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                    onClick={() => setOpen((s) => ({ ...s, [cat.id]: !isOpen }))}
                  >
                    <span className="text-sm font-semibold text-white">{cat.label}</span>
                    <span className="text-xs font-bold text-sky-300">
                      {cat.score.toFixed(1)}
                    </span>
                  </button>
                  <div className="px-4 pb-2">
                    <ScoreBar score={cat.score} />
                  </div>
                  {isOpen && (
                    <div className="grid gap-3 border-t border-white/5 px-4 py-3 md:grid-cols-2">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                          Strengths
                        </p>
                        <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-slate-300">
                          {cat.strengths.map((s) => (
                            <li key={s}>{s}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                          Improvements
                        </p>
                        <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-slate-300">
                          {cat.improvements.map((s) => (
                            <li key={s}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {result.redFlags.length > 0 && (
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-rose-300">
                Red flags
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-slate-300">
                {result.redFlags.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
          )}

          {result.nextSteps.length > 0 && (
            <div className="rounded-xl border border-white/5 bg-[#0a1628] p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-sky-400">
                Recommended next steps
              </p>
              <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-slate-300">
                {result.nextSteps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
