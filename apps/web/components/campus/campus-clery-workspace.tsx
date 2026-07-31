"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CLERY_CATEGORIES,
  CLERY_GEOGRAPHIES,
  CLERY_GEOGRAPHY_LABELS,
  type CleryCategory,
  type CleryEntry,
  type CleryGeography,
  type CleryReport,
} from "rapid-cortex-shared";

type Tab = "report" | "entries" | "manual" | "import";

function defaultAcademicYear(now = new Date()): string {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth(); // 0-based
  return m >= 7 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

async function readJson<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  }
  return data;
}

export function CampusCleryWorkspace({
  campusCode,
  canManage,
}: {
  campusCode: string;
  canManage: boolean;
}) {
  const code = campusCode.toUpperCase();
  const [tab, setTab] = useState<Tab>("report");
  const [academicYear, setAcademicYear] = useState(defaultAcademicYear);
  const [report, setReport] = useState<CleryReport | null>(null);
  const [entries, setEntries] = useState<CleryEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [category, setCategory] = useState<CleryCategory>("Burglary");
  const [geography, setGeography] = useState<CleryGeography>("on_campus");
  const [occurredAt, setOccurredAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [location, setLocation] = useState("");
  const [building, setBuilding] = useState("");
  const [notes, setNotes] = useState("");
  const [unfounded, setUnfounded] = useState(false);

  const [csvText, setCsvText] = useState(
    "occurredAt,category,geography,location,building,notes,externalRecordId,unfounded\n",
  );
  const [importSource, setImportSource] = useState("campus_pd_export");

  const qs = useMemo(
    () => `campusCode=${encodeURIComponent(code)}&academicYear=${encodeURIComponent(academicYear)}`,
    [code, academicYear],
  );

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const [reportRes, entriesRes] = await Promise.all([
        fetch(`/api/campus/clery/report?${qs}`),
        fetch(`/api/campus/clery/entries?${qs}`),
      ]);
      const reportData = await readJson<{ report: CleryReport }>(reportRes);
      const entriesData = await readJson<{ entries: CleryEntry[] }>(entriesRes);
      setReport(reportData.report);
      setEntries(entriesData.entries);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Clery data");
    } finally {
      setBusy(false);
    }
  }, [qs]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onCreateManual(e: React.FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await readJson(
        await fetch("/api/campus/clery/entries", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            campusCode: code,
            academicYear,
            category,
            geography,
            occurredAt: new Date(occurredAt).toISOString(),
            location,
            building,
            notes,
            unfounded,
            includedInAsr: true,
          }),
        }),
      );
      setNotice("Manual Clery entry saved.");
      setNotes("");
      await refresh();
      setTab("entries");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save entry");
    } finally {
      setBusy(false);
    }
  }

  async function onImportCsv(e: React.FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await readJson<{ created: number; skipped: number }>(
        await fetch("/api/campus/clery/import", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            campusCode: code,
            academicYear,
            sourceSystem: importSource,
            csv: csvText,
            skipDuplicates: true,
          }),
        }),
      );
      setNotice(`Import complete: ${result.created} created, ${result.skipped} skipped.`);
      await refresh();
      setTab("entries");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  async function onSyncPlatform() {
    if (!canManage) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await readJson<{ created: number; skipped: number }>(
        await fetch("/api/campus/clery/sync", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ campusCode: code, academicYear }),
        }),
      );
      setNotice(
        `Synced platform incidents: ${result.created} new Clery rows, ${result.skipped} skipped.`,
      );
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Platform sync failed");
    } finally {
      setBusy(false);
    }
  }

  async function onMarkReviewed(entryId: string) {
    if (!canManage) return;
    setBusy(true);
    setError(null);
    try {
      await readJson(
        await fetch(`/api/campus/clery/entries/${encodeURIComponent(entryId)}?${qs}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ reviewed: true }),
        }),
      );
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(entryId: string) {
    if (!canManage) return;
    if (!window.confirm("Remove this Clery entry?")) return;
    setBusy(true);
    setError(null);
    try {
      await readJson(
        await fetch(`/api/campus/clery/entries/${encodeURIComponent(entryId)}?${qs}`, {
          method: "DELETE",
        }),
      );
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  function downloadCsv() {
    window.open(`/api/campus/clery/report?${qs}&format=csv`, "_blank", "noopener,noreferrer");
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "report", label: "ASR report" },
    { id: "entries", label: "Entries" },
    { id: "manual", label: "Manual entry" },
    { id: "import", label: "Import / sync" },
  ];

  return (
    <div className="space-y-5">
      <header className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-5">
        <h2 className="text-lg font-semibold text-white">Clery Act reporting</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Build the Annual Security Report tally for {code}: pull classified Rapid Cortex campus
          incidents, import rows from campus PD / conduct systems, and add manual CSA entries.
          Classification and publication remain an institutional responsibility.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-xs text-slate-400">
            Academic year
            <input
              className="mt-1 block rounded border border-slate-600 bg-slate-950 px-3 py-2 font-mono text-sm text-white"
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value.trim())}
              placeholder="2025-2026"
            />
          </label>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={busy}
            className="rounded bg-slate-700 px-3 py-2 text-sm text-white hover:bg-slate-600 disabled:opacity-50"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={downloadCsv}
            className="rounded bg-sky-700 px-3 py-2 text-sm text-white hover:bg-sky-600"
          >
            Download CSV
          </button>
          {canManage && (
            <button
              type="button"
              onClick={() => void onSyncPlatform()}
              disabled={busy}
              className="rounded bg-emerald-800 px-3 py-2 text-sm text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              Sync from Rapid Cortex
            </button>
          )}
        </div>
        {error && (
          <p className="mt-3 rounded border border-red-800/60 bg-red-950/40 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        )}
        {notice && (
          <p className="mt-3 rounded border border-emerald-800/60 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-200">
            {notice}
          </p>
        )}
      </header>

      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded px-3 py-1.5 text-sm ${
              tab === t.id
                ? "bg-slate-100 text-slate-900"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "report" && (
        <section className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-5">
          {!report ? (
            <p className="text-sm text-slate-400">{busy ? "Loading…" : "No report yet."}</p>
          ) : (
            <>
              <p className="text-xs text-amber-200/90">{report.disclaimer}</p>
              <dl className="mt-4 grid gap-3 sm:grid-cols-4">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Entries</dt>
                  <dd className="text-2xl font-semibold text-white">{report.totals.entries}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">In ASR</dt>
                  <dd className="text-2xl font-semibold text-white">{report.totals.includedInAsr}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Unfounded</dt>
                  <dd className="text-2xl font-semibold text-white">{report.totals.unfounded}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Period</dt>
                  <dd className="text-sm text-slate-300">
                    {report.period.start.slice(0, 10)} → {report.period.end.slice(0, 10)}
                  </dd>
                </div>
              </dl>
              <div className="mt-6 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-slate-700 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-2 py-2">Category</th>
                      <th className="px-2 py-2">Geography</th>
                      <th className="px-2 py-2">Count</th>
                      <th className="px-2 py-2">Unfounded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.matrix.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-2 py-4 text-slate-500">
                          No included ASR rows yet. Add manual entries, import, or sync classified
                          incidents.
                        </td>
                      </tr>
                    ) : (
                      report.matrix.map((cell) => (
                        <tr key={`${cell.category}-${cell.geography}`} className="border-b border-slate-800">
                          <td className="px-2 py-2 text-slate-200">{cell.category}</td>
                          <td className="px-2 py-2 text-slate-300">
                            {CLERY_GEOGRAPHY_LABELS[cell.geography]}
                          </td>
                          <td className="px-2 py-2 text-white">{cell.count}</td>
                          <td className="px-2 py-2 text-slate-300">{cell.unfounded}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}

      {tab === "entries" && (
        <section className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-5">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-700 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-2 py-2">Occurred</th>
                  <th className="px-2 py-2">Category</th>
                  <th className="px-2 py-2">Geography</th>
                  <th className="px-2 py-2">Source</th>
                  <th className="px-2 py-2">Reviewed</th>
                  {canManage && <th className="px-2 py-2">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={canManage ? 6 : 5} className="px-2 py-4 text-slate-500">
                      No Clery entries for this academic year.
                    </td>
                  </tr>
                ) : (
                  entries.map((entry) => (
                    <tr key={entry.entryId} className="border-b border-slate-800 align-top">
                      <td className="px-2 py-2 font-mono text-xs text-slate-300">
                        {entry.occurredAt.slice(0, 10)}
                      </td>
                      <td className="px-2 py-2 text-slate-200">{entry.category}</td>
                      <td className="px-2 py-2 text-slate-300">
                        {CLERY_GEOGRAPHY_LABELS[entry.geography]}
                      </td>
                      <td className="px-2 py-2 text-slate-400">
                        {entry.source}
                        {entry.externalSourceSystem ? ` · ${entry.externalSourceSystem}` : ""}
                      </td>
                      <td className="px-2 py-2 text-slate-400">
                        {entry.reviewedAt ? entry.reviewedAt.slice(0, 10) : "—"}
                      </td>
                      {canManage && (
                        <td className="space-x-2 px-2 py-2">
                          {!entry.reviewedAt && (
                            <button
                              type="button"
                              className="text-sky-400 hover:underline"
                              onClick={() => void onMarkReviewed(entry.entryId)}
                            >
                              Mark reviewed
                            </button>
                          )}
                          <button
                            type="button"
                            className="text-red-400 hover:underline"
                            onClick={() => void onDelete(entry.entryId)}
                          >
                            Delete
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "manual" && (
        <section className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-5">
          {!canManage ? (
            <p className="text-sm text-slate-400">View-only role — ask a Campus Admin to add entries.</p>
          ) : (
            <form className="grid max-w-2xl gap-3" onSubmit={(e) => void onCreateManual(e)}>
              <label className="text-xs text-slate-400">
                Category
                <select
                  className="mt-1 block w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as CleryCategory)}
                >
                  {CLERY_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-slate-400">
                Geography
                <select
                  className="mt-1 block w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white"
                  value={geography}
                  onChange={(e) => setGeography(e.target.value as CleryGeography)}
                >
                  {CLERY_GEOGRAPHIES.map((g) => (
                    <option key={g} value={g}>
                      {CLERY_GEOGRAPHY_LABELS[g]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-slate-400">
                Occurred at
                <input
                  type="datetime-local"
                  className="mt-1 block w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white"
                  value={occurredAt}
                  onChange={(e) => setOccurredAt(e.target.value)}
                  required
                />
              </label>
              <label className="text-xs text-slate-400">
                Building
                <input
                  className="mt-1 block w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white"
                  value={building}
                  onChange={(e) => setBuilding(e.target.value)}
                />
              </label>
              <label className="text-xs text-slate-400">
                Location detail
                <input
                  className="mt-1 block w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </label>
              <label className="text-xs text-slate-400">
                Notes
                <textarea
                  className="mt-1 block w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={unfounded}
                  onChange={(e) => setUnfounded(e.target.checked)}
                />
                Unfounded
              </label>
              <button
                type="submit"
                disabled={busy}
                className="rounded bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600 disabled:opacity-50"
              >
                Save Clery entry
              </button>
            </form>
          )}
        </section>
      )}

      {tab === "import" && (
        <section className="space-y-4 rounded-lg border border-slate-700/50 bg-slate-900/40 p-5">
          <p className="text-sm text-slate-400">
            Paste a CSV export from campus police, student conduct, or another Clery source. Required
            columns: <code className="text-slate-300">occurredAt</code>,{" "}
            <code className="text-slate-300">category</code>. Optional: geography, location, building,
            notes, externalRecordId, unfounded, includedInAsr, hateCrimeBias.
          </p>
          {!canManage ? (
            <p className="text-sm text-slate-400">View-only role — imports require Campus Admin.</p>
          ) : (
            <form className="grid gap-3" onSubmit={(e) => void onImportCsv(e)}>
              <label className="text-xs text-slate-400">
                Source system label
                <input
                  className="mt-1 block w-full max-w-md rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white"
                  value={importSource}
                  onChange={(e) => setImportSource(e.target.value)}
                />
              </label>
              <label className="text-xs text-slate-400">
                CSV
                <textarea
                  className="mt-1 block w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 font-mono text-xs text-white"
                  rows={10}
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                />
              </label>
              <button
                type="submit"
                disabled={busy}
                className="w-fit rounded bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600 disabled:opacity-50"
              >
                Import CSV
              </button>
            </form>
          )}
        </section>
      )}
    </div>
  );
}
