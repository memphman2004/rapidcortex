"use client";

import { useState } from "react";
import type { VenueIntegrationImportBody } from "rapid-cortex-shared";
import { runVenueIntegrationImport } from "@/lib/venue/venue-rfp-api";

type ParsedRow = VenueIntegrationImportBody["records"][number];

function parseCsvPaste(text: string): ParsedRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);
  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = lines[i].split(",").map((c) => c.trim());
    const externalId = cols[idx("externalid")] || cols[idx("id")] || `row-${i}`;
    const displayName = cols[idx("displayname")] || cols[idx("name")] || externalId;
    const typeRaw = (cols[idx("type")] || "employee").toLowerCase();
    const type = typeRaw === "event" ? "event" : "employee";
    rows.push({
      externalId,
      type,
      displayName,
      email: cols[idx("email")] || undefined,
      department: cols[idx("department")] || undefined,
    });
  }
  return rows;
}

export function VenueImportAdmin({
  venueCode,
  canMutate,
}: {
  venueCode: string;
  canMutate: boolean;
}) {
  const [csvText, setCsvText] = useState(
    "externalId,type,displayName,email,department\nemp-1,employee,Jane Security,jane@venue.example,Ops",
  );
  const [dryRun, setDryRun] = useState(true);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function runImport() {
    if (!canMutate) return;
    setBusy(true);
    setError(null);
    setResult(null);
    const records = parseCsvPaste(csvText);
    if (records.length === 0) {
      setError("No records parsed — check CSV header row");
      setBusy(false);
      return;
    }
    const body: VenueIntegrationImportBody = {
      source: "csv_upload",
      records,
      dryRun,
    };
    try {
      const out = await runVenueIntegrationImport(venueCode, body);
      setResult(
        `${out.dryRun ? "Dry run" : "Import"} complete · imported ${out.imported}, skipped ${out.skipped} · run ${out.runId}`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  const previewCount = parseCsvPaste(csvText).length;

  return (
    <div
      className="space-y-4 rounded-lg border p-4"
      style={{ borderColor: "var(--rc-border)", background: "var(--rc-surface-alt)" }}
    >
      <h2 className="text-lg font-semibold" style={{ color: "var(--rc-amber)" }}>
        Directory / schedule import
      </h2>
      <p className="text-xs" style={{ color: "var(--rc-text-muted)" }}>
        Paste CSV with header{" "}
        <code className="text-[10px]">externalId,type,displayName,email,department</code>. Preview:{" "}
        {previewCount} rows.
      </p>
      <textarea
        className="min-h-[160px] w-full rounded border p-2 font-mono text-xs"
        style={{ borderColor: "var(--rc-border)", background: "var(--rc-surface-deep)" }}
        value={csvText}
        onChange={(e) => setCsvText(e.target.value)}
        disabled={!canMutate}
      />
      <label className="flex items-center gap-2 text-xs" style={{ color: "var(--rc-text-secondary)" }}>
        <input
          type="checkbox"
          checked={dryRun}
          onChange={(e) => setDryRun(e.target.checked)}
          disabled={!canMutate}
        />
        Dry run (validate only)
      </label>
      {error ? <p className="text-xs" style={{ color: "var(--rc-amber)" }}>{error}</p> : null}
      {result ? <p className="text-xs text-emerald-400">{result}</p> : null}
      {canMutate ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void runImport()}
          className="rounded border px-4 py-2 text-xs font-semibold"
          style={{ borderColor: "var(--rc-border)", color: "var(--rc-amber)" }}
        >
          {busy ? "Running…" : dryRun ? "Run dry-run import" : "Import records"}
        </button>
      ) : null}
    </div>
  );
}
