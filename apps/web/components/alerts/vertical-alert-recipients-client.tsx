"use client";

import { useState } from "react";
import type { AlertVertical } from "rapid-cortex-shared";

export function VerticalAlertRecipientsClient({ vertical }: { vertical: AlertVertical }) {
  const [csv, setCsv] = useState(
    "email,phone,first_name,last_name,groups,opt_in_date,opt_in_method,opt_in_consent_text\n",
  );
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const importCsv = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/alerts/recipients/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ vertical, csv }),
      });
      const data = (await res.json()) as {
        error?: string;
        imported?: number;
        updated?: number;
        failed?: number;
        errors?: Array<{ row: number; message: string }>;
      };
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      setResult(
        `Imported ${data.imported ?? 0}, updated ${data.updated ?? 0}, failed ${data.failed ?? 0}. ${
          (data.errors ?? []).map((e) => `Row ${e.row}: ${e.message}`).join(" ")
        }`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-white">Occupant recipient registry</h2>
      <p className="text-sm text-slate-400">
        Rapid Cortex does not invent a student directory. Import opted-in records from SIS (Banner,
        PeopleSoft, Workday) with TCPA consent. Phone rows require opt_in_date, opt_in_method, and
        opt_in_consent_text. This is not the inbound 10DLC safety-reporting campaign.
      </p>
      <textarea
        className="min-h-[220px] w-full rounded border border-slate-600 bg-slate-900 p-2 font-mono text-xs text-slate-200"
        value={csv}
        onChange={(e) => setCsv(e.target.value)}
      />
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {result ? <p className="text-sm text-emerald-300">{result}</p> : null}
      <button
        type="button"
        disabled={busy}
        onClick={() => void importCsv()}
        className="rounded bg-sky-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {busy ? "Importing…" : "Import CSV"}
      </button>
    </div>
  );
}
