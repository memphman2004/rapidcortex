"use client";

import { useMemo, useState } from "react";

type SortDir = "asc" | "desc";

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function ReportTable({
  rows,
  onExportCsv,
  exportBusy,
}: {
  rows: Record<string, unknown>[];
  onExportCsv?: () => void;
  exportBusy?: boolean;
}) {
  const columns = useMemo(() => {
    if (rows.length === 0) return [] as string[];
    const keys = new Set<string>();
    for (const row of rows) {
      for (const k of Object.keys(row)) keys.add(k);
    }
    return [...keys];
  }, [rows]);

  const [filter, setFilter] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      columns.some((col) => cellText(row[col]).toLowerCase().includes(q)),
    );
  }, [rows, columns, filter]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = cellText(a[sortKey]);
      const bv = cellText(b[sortKey]);
      const an = Number(av);
      const bn = Number(bv);
      if (!Number.isNaN(an) && !Number.isNaN(bn) && av !== "" && bv !== "") {
        return (an - bn) * dir;
      }
      return av.localeCompare(bv) * dir;
    });
  }, [filtered, sortKey, sortDir]);

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-slate-800 bg-slate-950/40 px-4 py-6 text-sm text-slate-500">
        No rows in this report.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="text-xs text-slate-400">
          Filter rows
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search all columns…"
            className="ml-2 w-56 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-200"
          />
        </label>
        {onExportCsv ? (
          <button
            type="button"
            disabled={exportBusy}
            onClick={onExportCsv}
            className="rounded bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 ring-1 ring-slate-700 disabled:opacity-40"
          >
            {exportBusy ? "Exporting…" : "Export CSV"}
          </button>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead className="bg-slate-950/80 text-xs uppercase text-slate-500">
            <tr>
              {columns.map((col) => (
                <th key={col} className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => toggleSort(col)}
                    className="inline-flex items-center gap-1 font-semibold hover:text-slate-300"
                  >
                    {col}
                    {sortKey === col ? (
                      <span className="text-sky-400">{sortDir === "asc" ? "↑" : "↓"}</span>
                    ) : null}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-slate-200">
            {sorted.map((row, i) => (
              <tr key={i} className="hover:bg-slate-900/50">
                {columns.map((col) => (
                  <td key={col} className="max-w-xs truncate px-3 py-2 text-xs">
                    {cellText(row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="border-t border-slate-800 px-3 py-2 text-[10px] text-slate-600">
          {sorted.length} of {rows.length} rows
        </p>
      </div>
    </div>
  );
}
