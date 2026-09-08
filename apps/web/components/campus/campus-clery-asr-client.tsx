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
  const code = campusCode.toUpperCase();
  const qs = `campusCode=${encodeURIComponent(code)}`;

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/campus/clery/asr/${year}/statistics?${qs}`, { cache: "no-store" });
      const data = (await res.json()) as Preview & { error?: string };
      if (!res.ok) setError(data.error || "Failed to load");
      else setPreview(data);
    })();
  }, [qs, year]);

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
            <div className="flex gap-2">
              <a
                className="rounded bg-sky-700 px-3 py-2 text-sm text-white"
                href={`/api/campus/clery/asr/${year}/download?${qs}`}
              >
                Download PDF
              </a>
              <a
                className="rounded border border-slate-600 px-3 py-2 text-sm text-slate-200"
                href={`/api/campus/clery/asr/${year}/ed-export?${qs}`}
              >
                ED survey CSV
              </a>
            </div>
          ) : null}
        </>
      ) : (
        <p className="text-sm text-slate-400">{error ?? "Loading…"}</p>
      )}
    </div>
  );
}
