"use client";

import { use, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Globe } from "lucide-react";
import type { InterpreterRequest } from "rapid-cortex-shared";
import { featureSuiteFetch } from "@/lib/feature-suite-client";
import { isFeaturesSuiteUiEnabled } from "@/lib/runtime-flags";

type Props = { params: Promise<{ jurisdiction: string }> };

function inRange(iso: string, from: string, to: string): boolean {
  const t = new Date(iso).getTime();
  if (from && t < new Date(from).getTime()) return false;
  if (to && t > new Date(to).getTime() + 86_400_000) return false;
  return true;
}

export function LanguageAccessClient({ params }: Props) {
  use(params);
  const enabled = isFeaturesSuiteUiEnabled();

  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  const listQ = useQuery({
    queryKey: ["interpreter-list"],
    queryFn: () =>
      featureSuiteFetch<{ requests: InterpreterRequest[] }>("interpreter"),
    enabled,
  });

  const rows = useMemo(() => {
    return (listQ.data?.requests ?? []).filter((r) =>
      inRange(r.requestedAt, from, to),
    );
  }, [listQ.data, from, to]);

  const summary = useMemo(() => {
    const byLang: Record<string, number> = {};
    let minutes = 0;
    let adequate = 0;
    for (const r of rows) {
      const key = r.languageDisplayName || r.language;
      byLang[key] = (byLang[key] ?? 0) + 1;
      minutes += (r.durationSeconds ?? 0) / 60;
      if (r.status === "completed" && r.callQuality !== "poor") adequate += 1;
    }
    const total = rows.length;
    return {
      total,
      languages: Object.keys(byLang).length,
      minutes: Math.round(minutes),
      adequatePct: total ? Math.round((adequate / total) * 100) : 0,
      byLang: Object.entries(byLang).sort((a, b) => b[1] - a[1]),
    };
  }, [rows]);

  const exportCsv = () => {
    const header = [
      "incidentId",
      "language",
      "method",
      "durationSeconds",
      "status",
      "callQuality",
      "requestedAt",
    ];
    const lines = [
      header.join(","),
      ...rows.map((r) =>
        [
          r.incidentId,
          r.languageDisplayName || r.language,
          r.method,
          r.durationSeconds ?? "",
          r.status,
          r.callQuality ?? "",
          r.requestedAt,
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(","),
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `language-access-${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!enabled) {
    return <div className="p-6 text-sm text-slate-400">Language access reporting is not enabled.</div>;
  }

  const maxLang = Math.max(1, ...summary.byLang.map(([, n]) => n));

  return (
    <div className="min-h-full space-y-6 bg-[#0f1117] p-4 md:p-6 text-[#e2e4ea]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold text-white">
            <Globe className="h-5 w-5 text-sky-400" />
            Language Access Report
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            LEP / ADA compliance summary from interpreter sessions.
          </p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          disabled={rows.length === 0}
          className="inline-flex items-center gap-1.5 rounded border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <label className="text-xs text-slate-400">
          From
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-1 block rounded border border-slate-700 bg-[#161b2e] px-3 py-2 text-sm text-slate-200"
          />
        </label>
        <label className="text-xs text-slate-400">
          To
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="mt-1 block rounded border border-slate-700 bg-[#161b2e] px-3 py-2 text-sm text-slate-200"
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Interactions", value: summary.total },
          { label: "Languages", value: summary.languages },
          { label: "Adequate access %", value: `${summary.adequatePct}%` },
          { label: "Total minutes", value: summary.minutes },
          { label: "Compliance score", value: `${summary.adequatePct}%` },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-slate-800 bg-[#161b2e] px-4 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {s.label}
            </div>
            <div className="mt-1 text-2xl font-semibold text-sky-300">{s.value}</div>
          </div>
        ))}
      </div>

      <section className="rounded-lg border border-slate-800 bg-[#161b2e] p-4">
        <h2 className="mb-3 text-sm font-semibold">By language</h2>
        {summary.byLang.length === 0 ? (
          <p className="text-xs text-slate-500">No sessions in range.</p>
        ) : (
          <ul className="space-y-2">
            {summary.byLang.map(([lang, count]) => (
              <li key={lang} className="flex items-center gap-3 text-sm">
                <span className="w-28 truncate text-slate-300">{lang}</span>
                <div className="h-2 flex-1 rounded bg-slate-800">
                  <div
                    className="h-2 rounded bg-sky-600"
                    style={{ width: `${(count / maxLang) * 100}%` }}
                  />
                </div>
                <span className="w-8 text-right text-slate-400">{count}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="overflow-x-auto rounded-lg border border-slate-800 bg-[#161b2e]">
        {listQ.isLoading && <p className="p-4 text-xs text-slate-500">Loading…</p>}
        {listQ.isError && (
          <p className="p-4 text-xs text-red-400">{(listQ.error as Error).message}</p>
        )}
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-3 py-2">Incident</th>
              <th className="px-3 py-2">Language</th>
              <th className="px-3 py-2">Method</th>
              <th className="px-3 py-2">Duration</th>
              <th className="px-3 py-2">Adequate</th>
              <th className="px-3 py-2">Requested</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const adequate = r.status === "completed" && r.callQuality !== "poor";
              return (
                <tr key={r.requestId} className="border-b border-slate-800/80">
                  <td className="px-3 py-2 font-mono text-xs">{r.incidentId}</td>
                  <td className="px-3 py-2">{r.languageDisplayName || r.language}</td>
                  <td className="px-3 py-2 capitalize text-slate-400">
                    {r.method.replace(/_/g, " ")}
                  </td>
                  <td className="px-3 py-2 text-slate-400">
                    {r.durationSeconds != null
                      ? `${Math.round(r.durationSeconds / 60)}m`
                      : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        adequate ? "text-emerald-400" : "text-amber-300"
                      }
                    >
                      {adequate ? "Yes" : "No / pending"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-500">
                    {new Date(r.requestedAt).toLocaleString()}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && !listQ.isLoading && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                  No interpreter records in this date range.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
