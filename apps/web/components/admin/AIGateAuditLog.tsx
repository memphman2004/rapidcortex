"use client";

import { useEffect, useState } from "react";
import type { AIGateAuditRecord } from "rapid-cortex-shared";

type Props = { agencyId: string };

const ACTION_CLASS: Record<AIGateAuditRecord["action"], string> = {
  AI_ENABLED: "text-emerald-300",
  AI_DISABLED: "text-amber-300",
  FEATURE_CHANGED: "text-sky-300",
};

export function AIGateAuditLog({ agencyId }: Props) {
  const [history, setHistory] = useState<AIGateAuditRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/agency/${encodeURIComponent(agencyId)}/config/ai-mode/audit?limit=50`,
          { credentials: "same-origin" },
        );
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        const data = (await res.json()) as { history?: AIGateAuditRecord[] };
        if (!cancelled) setHistory(data.history ?? []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [agencyId]);

  return (
    <div className="space-y-3 rounded-lg border border-slate-700/80 bg-slate-900/60 p-4">
      <h2 className="text-base font-semibold text-white">AI gate audit</h2>
      {loading && <p className="text-sm text-slate-500">Loading…</p>}
      {error && <p className="text-sm text-rose-400">{error}</p>}
      {!loading && !error && history.length === 0 && (
        <p className="text-sm text-slate-500">No toggle history yet.</p>
      )}
      {history.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="px-2 py-1.5">Timestamp</th>
                <th className="px-2 py-1.5">Actor</th>
                <th className="px-2 py-1.5">Action</th>
                <th className="px-2 py-1.5">Reason</th>
              </tr>
            </thead>
            <tbody>
              {history.map((row) => (
                <tr key={`${row.auditedAt}-${row.auditedBy}`} className="border-t border-slate-800">
                  <td className="px-2 py-1.5 text-slate-400">
                    {new Date(row.auditedAt).toLocaleString()}
                  </td>
                  <td className="px-2 py-1.5 text-slate-300">{row.auditedByDisplay}</td>
                  <td className={`px-2 py-1.5 font-medium ${ACTION_CLASS[row.action]}`}>
                    {row.action}
                  </td>
                  <td className="px-2 py-1.5 text-slate-400">{row.reason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
