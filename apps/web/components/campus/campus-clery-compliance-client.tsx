"use client";

import { useEffect, useState } from "react";

type Dash = {
  pendingReviewCount: number;
  overdueDclCount: number;
  classifiedCount: number;
  unfoundedCount: number;
  zoneConfig: { configured: number; total: number; missing: number };
  csaCount: number;
  csaTrainingExpired: number;
  asr: { reportYear: number; publishDeadline: string; status: string };
  publicCrimeLogPath: string;
};

export function CampusCleryComplianceClient({ campusCode }: { campusCode: string }) {
  const code = campusCode.toUpperCase();
  const [dash, setDash] = useState<Dash | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/campus/clery/compliance?campusCode=${encodeURIComponent(code)}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as Dash & { error?: string };
      if (!res.ok) setError(data.error || "Failed to load");
      else setDash(data);
    })();
  }, [code]);

  if (!dash) return <p className="text-sm text-slate-400">{error ?? "Loading…"}</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-white">Clery compliance dashboard</h1>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Pending review", dash.pendingReviewCount],
          ["DCL overdue", dash.overdueDclCount],
          ["Classified", dash.classifiedCount],
          ["Unfounded", dash.unfoundedCount],
        ].map(([label, n]) => (
          <div key={String(label)} className="rounded border border-slate-700 bg-slate-900 p-3">
            <p className="text-xs text-slate-400">{label}</p>
            <p className="text-2xl font-semibold text-white">{n}</p>
          </div>
        ))}
      </div>
      <p className="text-sm text-slate-300">
        Zones configured: {dash.zoneConfig.configured}/{dash.zoneConfig.total} ({dash.zoneConfig.missing} missing)
      </p>
      <p className="text-sm text-slate-300">
        CSAs: {dash.csaCount} · training expired: {dash.csaTrainingExpired}
      </p>
      <p className="text-sm text-slate-300">
        ASR {dash.asr.reportYear} · {dash.asr.status} · due {dash.asr.publishDeadline.slice(0, 10)}
      </p>
      <p className="text-sm">
        Public crime log:{" "}
        <a className="text-sky-400 underline" href={dash.publicCrimeLogPath}>
          {dash.publicCrimeLogPath}
        </a>
      </p>
    </div>
  );
}
