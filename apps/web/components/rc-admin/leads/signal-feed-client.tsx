"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LeadVerticalSchema,
  type LeadSignal,
  type LeadVertical,
} from "rapid-cortex-shared";
import { formatDateTime, verticalLabel } from "@/components/rc-admin/leads/leads-utils";

const VERTICALS = LeadVerticalSchema.options.filter((v) => v !== "unknown") as LeadVertical[];

/**
 * Chronological signal feed — always scoped to one vertical at a time.
 * Campus never sees venue/911 signals and vice versa.
 */
export function SignalFeedClient({ initialVertical = "rc911" }: { initialVertical?: LeadVertical }) {
  const [vertical, setVertical] = useState<LeadVertical>(initialVertical);
  const [signals, setSignals] = useState<LeadSignal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/rc-admin/signal-feed?vertical=${encodeURIComponent(vertical)}&days=30`,
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { signals?: LeadSignal[] };
        if (cancelled) return;
        // Hard filter — API must also scope; UI never trusts cross-vertical rows
        setSignals((data.signals ?? []).filter((s) => s.vertical === vertical));
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load");
          setSignals([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [vertical]);

  const counts = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return {
      total: signals.length,
      today: signals.filter((s) => s.detectedAt.startsWith(today)).length,
      strong: signals.filter((s) => s.strength === "strong").length,
    };
  }, [signals]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-white">Signal Feed</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Chronological buying-intent signals for one product vertical at a time. Switching
          verticals clears the list — no cross-vertical bleed.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {VERTICALS.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setVertical(v)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
              vertical === v
                ? "border-sky-400 bg-sky-500/20 text-sky-200"
                : "border-slate-700 text-slate-400"
            }`}
          >
            {verticalLabel(v)}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Signals (30d)" value={counts.total} />
        <Stat label="Today" value={counts.today} />
        <Stat label="Strong" value={counts.strong} />
      </div>

      {loading ? <p className="text-sm text-slate-500">Loading {verticalLabel(vertical)}…</p> : null}
      {error ? <p className="text-sm text-amber-400">{error}</p> : null}

      <div className="space-y-2">
        {signals.map((s) => (
          <div
            key={s.signalId}
            className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wide text-slate-500">
                <span>{s.type.replaceAll("_", " ")}</span>
                <span>·</span>
                <span>{s.strength}</span>
                <span>·</span>
                <span>{s.source}</span>
              </div>
              <p className="mt-1 text-sm font-semibold text-white">{s.title}</p>
              <p className="mt-0.5 text-xs text-slate-400">{s.summary}</p>
            </div>
            <div className="shrink-0 text-right text-[11px] text-slate-500">
              <div>{formatDateTime(s.detectedAt)}</div>
              <a
                href={`/rc-admin/leads?leadId=${encodeURIComponent(s.leadId)}`}
                className="text-sky-400 hover:underline"
              >
                Open lead
              </a>
            </div>
          </div>
        ))}
        {!loading && signals.length === 0 ? (
          <p className="text-sm text-slate-500">No signals for {verticalLabel(vertical)} yet.</p>
        ) : null}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-100">{value}</p>
    </div>
  );
}
