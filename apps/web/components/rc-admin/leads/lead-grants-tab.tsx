"use client";

import { useCallback, useEffect, useState } from "react";
import {
  filterSignalsForVertical,
  type GrantMatchOutcome,
  type LeadVertical,
  type SalesLeadCrmRecord,
} from "rapid-cortex-shared";

type GrantMatchRow = {
  grantId: string;
  leadId: string;
  matchScore: number;
  matchReason: string;
  matchedAt: string;
  outcome?: GrantMatchOutcome | null;
  vertical: LeadVertical;
  title?: string;
  agency?: string;
  awardCeiling?: number;
  closeDate?: string;
  sourceUrl?: string;
};

const OUTCOMES: GrantMatchOutcome[] = ["applied", "not_applicable", "won", "lost"];

export function LeadGrantsTab({ lead }: { lead: SalesLeadCrmRecord }) {
  const [rows, setRows] = useState<GrantMatchRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const vertical = lead.vertical && lead.vertical !== "unknown" ? lead.vertical : "rc911";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/rc-admin/leads/${encodeURIComponent(lead.leadId)}/grant-matches?vertical=${encodeURIComponent(vertical)}`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { matches?: GrantMatchRow[] };
      // Defense in depth — never render another vertical's matches
      setRows((data.matches ?? []).filter((m) => m.vertical === vertical));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load grants");
      // Fallback: show GRANT_SIGNAL summaries scoped to this lead's vertical
      const signals = filterSignalsForVertical(lead.signals, vertical).filter(
        (s) => s.type === "GRANT_SIGNAL",
      );
      setRows(
        signals.map((s) => ({
          grantId: s.signalId,
          leadId: lead.leadId,
          matchScore: s.strength === "strong" ? 80 : 60,
          matchReason: s.summary,
          matchedAt: s.detectedAt,
          vertical: s.vertical,
          title: s.title,
          sourceUrl: s.sourceUrl,
        })),
      );
    } finally {
      setLoading(false);
    }
  }, [lead.leadId, lead.signals, vertical]);

  useEffect(() => {
    void load();
  }, [load]);

  async function setOutcome(grantId: string, outcome: GrantMatchOutcome) {
    const res = await fetch(
      `/api/rc-admin/leads/${encodeURIComponent(lead.leadId)}/grant-matches/${encodeURIComponent(grantId)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome }),
      },
    );
    if (!res.ok) {
      setError(`Could not save outcome (${res.status})`);
      return;
    }
    setRows((prev) => prev.map((r) => (r.grantId === grantId ? { ...r, outcome } : r)));
  }

  if (loading) {
    return <p className="p-4 text-sm text-slate-500">Loading grants for {vertical}…</p>;
  }

  return (
    <div className="space-y-3 p-4">
      <p className="text-xs text-slate-500">
        Showing grants for vertical <span className="font-semibold text-slate-300">{vertical}</span> only.
      </p>
      {error ? <p className="text-xs text-amber-400">{error}</p> : null}
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">No grant matches for this vertical yet.</p>
      ) : (
        rows.map((row) => {
          const closeMs = row.closeDate ? Date.parse(row.closeDate) : NaN;
          const days =
            Number.isFinite(closeMs) ? Math.ceil((closeMs - Date.now()) / 86400000) : null;
          const urgency =
            days != null && days < 14
              ? "text-red-400"
              : days != null && days < 30
                ? "text-amber-400"
                : "text-slate-400";
          return (
            <article
              key={row.grantId}
              className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    {row.title ?? `Grant ${row.grantId.slice(0, 8)}`}
                  </h3>
                  {row.agency ? (
                    <p className="mt-0.5 text-xs text-slate-400">{row.agency}</p>
                  ) : null}
                </div>
                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                  Match {row.matchScore}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-400">{row.matchReason}</p>
              <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-500">
                {row.awardCeiling != null ? (
                  <span>Up to ${row.awardCeiling.toLocaleString()}</span>
                ) : null}
                {row.closeDate ? (
                  <span className={urgency}>
                    Closes {row.closeDate}
                    {days != null ? ` (${days}d)` : ""}
                  </span>
                ) : null}
              </div>
              {row.sourceUrl ? (
                <a
                  href={row.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-xs text-sky-400 hover:underline"
                >
                  Open listing
                </a>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {OUTCOMES.map((o) => (
                  <button
                    key={o}
                    type="button"
                    onClick={() => void setOutcome(row.grantId, o)}
                    className={`rounded-lg border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                      row.outcome === o
                        ? "border-sky-400 bg-sky-500/20 text-sky-200"
                        : "border-slate-700 text-slate-400 hover:border-slate-500"
                    }`}
                  >
                    {o.replaceAll("_", " ")}
                  </button>
                ))}
              </div>
            </article>
          );
        })
      )}
    </div>
  );
}
