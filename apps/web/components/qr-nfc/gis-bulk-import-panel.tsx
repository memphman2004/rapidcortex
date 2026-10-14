"use client";

/**
 * GIS CSV bulk-import: client-side parse → preview → controlled commit.
 * Never creates new QR/NFC codes or changes public URLs.
 */
import { useMemo, useState } from "react";

type GisRow = {
  safetyPointId: string;
  siteCode?: string;
  buildingName?: string;
  floor?: string;
  zone?: string;
  latitude: number;
  longitude: number;
};

type PreviewResponse = {
  agencyId: string;
  valid: Array<GisRow & { name?: string }>;
  unmatched: Array<{ safetyPointId: string; reason: string }>;
  invalid: Array<{ row: unknown; errors: string[] }>;
  summary: { total: number; valid: number; unmatched: number; invalid: number };
};

type CommitResponse = {
  agencyId: string;
  updated: number;
  skipped: number;
};

function parseCsv(text: string): { rows: GisRow[]; errors: string[] } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) {
    return { rows: [], errors: ["CSV needs a header row and at least one data row."] };
  }
  const header = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase());
  const idx = (name: string) => header.indexOf(name);
  const idIdx = idx("safetypointid") >= 0 ? idx("safetypointid") : idx("qr_id") >= 0 ? idx("qr_id") : idx("qrid");
  const latIdx = idx("latitude") >= 0 ? idx("latitude") : idx("lat");
  const lngIdx = idx("longitude") >= 0 ? idx("longitude") : idx("lng") >= 0 ? idx("lng") : idx("lon");
  if (idIdx < 0 || latIdx < 0 || lngIdx < 0) {
    return {
      rows: [],
      errors: ["Required columns: safetyPointId (or qrId), latitude, longitude."],
    };
  }
  const rows: GisRow[] = [];
  const errors: string[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const safetyPointId = cols[idIdx]?.trim();
    const latitude = Number(cols[latIdx]);
    const longitude = Number(cols[lngIdx]);
    if (!safetyPointId || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      errors.push(`Row ${i + 1}: missing id or invalid coordinates`);
      continue;
    }
    const pick = (name: string) => {
      const j = idx(name);
      return j >= 0 && cols[j] ? cols[j] : undefined;
    };
    rows.push({
      safetyPointId,
      latitude,
      longitude,
      siteCode: pick("sitecode"),
      buildingName: pick("buildingname") ?? pick("building"),
      floor: pick("floor"),
      zone: pick("zone"),
    });
  }
  return { rows, errors };
}

export function GisBulkImportPanel({
  agencyId,
  apiBase,
  canImport,
  onCommitted,
}: {
  agencyId: string;
  apiBase: string;
  canImport: boolean;
  onCommitted?: () => void;
}) {
  const [csvText, setCsvText] = useState("");
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const localParse = useMemo(() => (csvText.trim() ? parseCsv(csvText) : null), [csvText]);

  if (!canImport) return null;

  async function runPreview() {
    setBusy(true);
    setError(null);
    setMessage(null);
    setPreview(null);
    try {
      const parsed = parseCsv(csvText);
      if (parsed.errors.length && parsed.rows.length === 0) {
        setError(parsed.errors.join(" "));
        return;
      }
      const res = await fetch(`${apiBase}/gis-import/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agencyId, rows: parsed.rows }),
      });
      const body = (await res.json().catch(() => ({}))) as PreviewResponse & { error?: string };
      if (!res.ok) {
        setError(body.error ?? `Preview failed (${res.status})`);
        return;
      }
      setPreview(body);
      setMessage(
        `Preview: ${body.summary.valid} ready, ${body.summary.unmatched} unmatched, ${parsed.errors.length} local parse warnings.`,
      );
    } catch {
      setError("Network error during preview.");
    } finally {
      setBusy(false);
    }
  }

  async function runCommit() {
    if (!preview?.valid.length) return;
    const okConfirm = window.confirm(
      `Commit ${preview.valid.length} GIS coordinate update(s) for this agency?\n\n` +
        `Codes stay UNVERIFIED. Public QR/NFC URLs are never changed.`,
    );
    if (!okConfirm) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/gis-import/commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agencyId,
          confirmCommit: true,
          rows: preview.valid.map(({ name: _n, ...row }) => row),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as CommitResponse & { error?: string };
      if (!res.ok) {
        setError(body.error ?? `Commit failed (${res.status})`);
        return;
      }
      setMessage(`Committed ${body.updated} update(s); skipped ${body.skipped}.`);
      setPreview(null);
      setCsvText("");
      onCommitted?.();
    } catch {
      setError("Network error during commit.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        GIS CSV bulk import
      </h3>
      <p className="mt-1 text-xs text-slate-500">
        Preview matches existing codes in this agency only. Import updates coordinates as UNVERIFIED
        and never creates codes or changes stable QR/NFC URLs.
      </p>
      <textarea
        value={csvText}
        onChange={(e) => setCsvText(e.target.value)}
        rows={5}
        placeholder={
          "safetyPointId,latitude,longitude,buildingName,floor,zone\n01ABC…,39.1653,-86.5264,Union,2,North"
        }
        className="mt-3 w-full rounded border border-slate-700 bg-slate-950 px-2 py-2 font-mono text-xs text-slate-200"
      />
      {localParse?.errors.length ? (
        <p className="mt-1 text-[11px] text-amber-300">{localParse.errors.slice(0, 3).join(" · ")}</p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !csvText.trim()}
          onClick={() => void runPreview()}
          className="rounded border border-sky-700 px-3 py-1.5 text-xs text-sky-200 hover:bg-sky-950/40 disabled:opacity-50"
        >
          {busy ? "Working…" : "Preview"}
        </button>
        <button
          type="button"
          disabled={busy || !preview?.valid.length}
          onClick={() => void runCommit()}
          className="rounded border border-emerald-700 px-3 py-1.5 text-xs text-emerald-200 hover:bg-emerald-950/40 disabled:opacity-50"
        >
          Commit valid rows
        </button>
      </div>
      {message ? <p className="mt-2 text-xs text-slate-300">{message}</p> : null}
      {error ? <p className="mt-2 text-xs text-rose-300">{error}</p> : null}
      {preview ? (
        <div className="mt-3 grid gap-2 text-[11px] text-slate-400 sm:grid-cols-2">
          <div>
            <p className="font-semibold text-slate-300">Valid ({preview.valid.length})</p>
            <ul className="mt-1 max-h-28 overflow-y-auto">
              {preview.valid.slice(0, 40).map((r) => (
                <li key={r.safetyPointId}>
                  {r.name ?? r.safetyPointId}: {r.latitude.toFixed(5)}, {r.longitude.toFixed(5)}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-semibold text-slate-300">Unmatched ({preview.unmatched.length})</p>
            <ul className="mt-1 max-h-28 overflow-y-auto">
              {preview.unmatched.slice(0, 40).map((r) => (
                <li key={r.safetyPointId}>
                  {r.safetyPointId}: {r.reason}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
