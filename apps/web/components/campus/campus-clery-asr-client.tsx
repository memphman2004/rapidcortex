"use client";

import { useEffect, useState } from "react";
import { CLERY_OFFENSE_DISPLAY_NAMES } from "rapid-cortex-shared";

type Preview = {
  reportYear: number;
  coverageYears: [number, number, number];
  publishDeadline: string;
  disclaimer: string;
  coordinatorNotice: string;
  statistics: {
    offenses: Array<{
      calendarYear: number;
      offenseCategory: string;
      onCampus: number;
      onCampusResidential: number;
      nonCampus: number;
      publicProperty: number;
      unfounded: number;
    }>;
  };
};

export function CampusCleryAsrClient({ campusCode, canGenerate }: { campusCode: string; canGenerate: boolean }) {
  const year = new Date().getUTCFullYear();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preparedBy, setPreparedBy] = useState("");
  const [notes, setNotes] = useState("");
  const [institutionName, setInstitutionName] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);
  const code = campusCode.toUpperCase();
  const qs = `campusCode=${encodeURIComponent(code)}`;

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/campus/clery/asr/${year}/statistics?${qs}`, { cache: "no-store" });
      const data = (await res.json()) as Preview & { error?: string };
      if (!res.ok) setError(data.error || "Failed to load");
      else {
        setPreview(data);
        const fromDisclaimer = data.disclaimer.match(/reviewed by (.+?)'s designated/)?.[1];
        if (fromDisclaimer && !institutionName) setInstitutionName(fromDisclaimer);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed institution once from preview
  }, [qs, year]);

  async function downloadPdf() {
    setPdfBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/campus/clery/asr/${year}/download`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          campusCode: code,
          preparedBy: preparedBy.trim() || undefined,
          notes: notes.trim() || undefined,
          institutionName: institutionName.trim() || undefined,
          addressLine: addressLine.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `PDF failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `asr-${code}-${year}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to export ASR PDF");
    } finally {
      setPdfBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-white">Annual Security Report</h1>
      {preview ? (
        <>
          <p className="rounded border border-amber-500/40 bg-amber-950/30 p-3 text-sm text-amber-100">
            {preview.coordinatorNotice}
          </p>
          <p className="text-xs text-slate-400">{preview.disclaimer}</p>
          <p className="text-sm text-slate-300">
            Coverage {preview.coverageYears.join(" / ")} · October 1 deadline {preview.publishDeadline.slice(0, 10)}
          </p>

          <div className="grid gap-3 sm:grid-cols-2 rounded-lg border border-slate-700/50 bg-slate-900/40 p-4">
            <label className="text-xs text-slate-400">
              Institution name
              <input
                className="mt-1 block w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white"
                value={institutionName}
                onChange={(e) => setInstitutionName(e.target.value)}
                maxLength={200}
              />
            </label>
            <label className="text-xs text-slate-400">
              Prepared by
              <input
                className="mt-1 block w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white"
                value={preparedBy}
                onChange={(e) => setPreparedBy(e.target.value)}
                placeholder="Name / title"
                maxLength={120}
              />
            </label>
            <label className="text-xs text-slate-400 sm:col-span-2">
              Address / location line
              <input
                className="mt-1 block w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white"
                value={addressLine}
                onChange={(e) => setAddressLine(e.target.value)}
                maxLength={400}
              />
            </label>
            <label className="text-xs text-slate-400 sm:col-span-2">
              Notes for this ASR draft
              <textarea
                className="mt-1 block w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional narrative included on the PDF with live Clery statistics"
                maxLength={4000}
                rows={3}
              />
            </label>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-200">
              <thead>
                <tr className="text-slate-400">
                  <th className="py-2">Offense</th>
                  <th>Year</th>
                  <th>OC</th>
                  <th>RES</th>
                  <th>NC</th>
                  <th>PP</th>
                  <th>Unfounded</th>
                </tr>
              </thead>
              <tbody>
                {preview.statistics.offenses.map((row) => (
                  <tr key={`${row.calendarYear}-${row.offenseCategory}`} className="border-t border-slate-800">
                    <td className="py-1">
                      {CLERY_OFFENSE_DISPLAY_NAMES[row.offenseCategory as keyof typeof CLERY_OFFENSE_DISPLAY_NAMES] ??
                        row.offenseCategory}
                    </td>
                    <td>{row.calendarYear}</td>
                    <td>{row.onCampus}</td>
                    <td>{row.onCampusResidential}</td>
                    <td>{row.nonCampus}</td>
                    <td>{row.publicProperty}</td>
                    <td>{row.unfounded}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {canGenerate ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void downloadPdf()}
                disabled={pdfBusy}
                className="rounded bg-sky-700 px-3 py-2 text-sm text-white hover:bg-sky-600 disabled:opacity-50"
              >
                {pdfBusy ? "Building PDF…" : "Download PDF"}
              </button>
              <a
                className="rounded border border-slate-600 px-3 py-2 text-sm text-slate-200"
                href={`/api/campus/clery/asr/${year}/ed-export?${qs}`}
              >
                ED survey CSV
              </a>
            </div>
          ) : null}
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        </>
      ) : (
        <p className="text-sm text-slate-400">{error ?? "Loading…"}</p>
      )}
    </div>
  );
}
