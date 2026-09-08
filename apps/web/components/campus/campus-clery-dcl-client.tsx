"use client";

import { useEffect, useState } from "react";
import type { DailyCrimeLogEntry } from "rapid-cortex-shared";

export function CampusCleryDclClient({ campusCode }: { campusCode: string }) {
  const [entries, setEntries] = useState<DailyCrimeLogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const code = campusCode.toUpperCase();

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/campus/clery/daily-crime-log?campusCode=${encodeURIComponent(code)}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as { entries?: DailyCrimeLogEntry[]; error?: string };
      if (!res.ok) setError(data.error || "Failed to load");
      else setEntries(data.entries ?? []);
    })();
  }, [code]);

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold text-white">Daily Crime Log (internal)</h1>
      <p className="text-sm text-slate-400">
        Public log:{" "}
        <a className="text-sky-400 underline" href={`/crime-log/${code.toLowerCase()}`} target="_blank" rel="noreferrer">
          /crime-log/{code.toLowerCase()}
        </a>
      </p>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <table className="w-full text-left text-sm text-slate-200">
        <thead className="text-xs uppercase text-slate-400">
          <tr>
            <th className="py-2">Reported</th>
            <th>Occurred</th>
            <th>Location</th>
            <th>Category</th>
            <th>Disposition</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.entryId} className="border-t border-slate-800">
              <td className="py-2">
                {e.reportedDate} {e.reportedTime}
              </td>
              <td>
                {e.occurredDate} {e.occurredTime}
              </td>
              <td>{e.generalLocation}</td>
              <td>{e.offenseCategoryDisplayName}</td>
              <td>{e.disposition}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
