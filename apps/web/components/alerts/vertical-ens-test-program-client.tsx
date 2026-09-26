"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ENS_TEST_KIND_LABELS,
  type EnsSiteBoundary,
  type EnsTestKind,
  type EnsTestProgram,
  type EnsTestRun,
  type AlertVertical,
} from "rapid-cortex-shared";
import { isFourwindsEnabled } from "@/lib/runtime-flags";

type Props = {
  vertical: AlertVertical;
  basePath: string;
  displayName: string;
  canManage: boolean;
  canRun: boolean;
};

async function readJson<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function polygonToText(polygon: Array<[number, number]> | undefined): string {
  if (!polygon?.length) return "";
  return polygon.map(([lng, lat]) => `${lng},${lat}`).join("\n");
}

function parsePolygonText(raw: string): Array<[number, number]> {
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const out: Array<[number, number]> = [];
  for (const line of lines) {
    const [lng, lat] = line.split(",").map((x) => Number(x.trim()));
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) throw new Error(`Invalid coordinate: ${line}`);
    out.push([lng, lat]);
  }
  if (out.length < 3) throw new Error("Boundary needs at least 3 points (lng,lat per line)");
  return out;
}

export function VerticalEnsTestProgramClient({
  vertical,
  basePath,
  displayName,
  canManage,
  canRun,
}: Props) {
  const [program, setProgram] = useState<EnsTestProgram | null>(null);
  const [boundary, setBoundary] = useState<EnsSiteBoundary | null>(null);
  const [runs, setRuns] = useState<EnsTestRun[]>([]);
  const [boundaryDraft, setBoundaryDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [runKind, setRunKind] = useState<EnsTestKind>("monthly_silent");
  const [confirm, setConfirm] = useState("");
  const [running, setRunning] = useState(false);

  const q = `vertical=${encodeURIComponent(vertical)}`;

  const load = useCallback(async () => {
    const [p, b, r] = await Promise.all([
      readJson<{ program: EnsTestProgram }>(await fetch(`/api/alerts/ens/program?${q}`, { cache: "no-store" })),
      readJson<{ boundary: EnsSiteBoundary | null }>(
        await fetch(`/api/alerts/ens/boundary?${q}`, { cache: "no-store" }),
      ),
      readJson<{ runs: EnsTestRun[] }>(await fetch(`/api/alerts/ens/runs?${q}`, { cache: "no-store" })),
    ]);
    setProgram(p.program);
    setBoundary(b.boundary);
    setBoundaryDraft(polygonToText(b.boundary?.boundaryPolygon));
    setRuns(r.runs);
  }, [q]);

  useEffect(() => {
    void load().catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, [load]);

  const saveProgram = async () => {
    if (!program || !canManage) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/alerts/ens/program?${q}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(program),
      });
      const data = await readJson<{ program: EnsTestProgram }>(res);
      setProgram(data.program);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const saveBoundary = async () => {
    if (!canManage) return;
    setSaving(true);
    setError(null);
    try {
      const boundaryPolygon = parsePolygonText(boundaryDraft);
      const res = await fetch(`/api/alerts/ens/boundary?${q}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ vertical, boundaryPolygon }),
      });
      const data = await readJson<{ boundary: EnsSiteBoundary }>(res);
      setBoundary(data.boundary);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Boundary save failed");
    } finally {
      setSaving(false);
    }
  };

  const runTest = async () => {
    if (!canRun || confirm.trim().toUpperCase() !== "CONFIRM") return;
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/alerts/ens/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ vertical, kind: runKind, confirmation: confirm }),
      });
      await readJson(res);
      setConfirm("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Run failed");
    } finally {
      setRunning(false);
    }
  };

  if (!program) {
    return <p className="text-sm text-slate-400">Loading ENS test program…</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <Link className="text-sm text-sky-400 hover:underline" href={basePath}>
          ← Occupant alerts
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-white">ENS test program</h1>
        <p className="mt-1 text-sm text-slate-400">
          Monthly silent, semester audible, and annual comprehensive tests for {displayName}. Includes 1-mile
          outer-ring geofencing, Four Winds display takeover{isFourwindsEnabled() ? "" : " (flag off)"}, and
          Clery-ready PDF reports.
        </p>
      </div>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      <section className="rounded-lg border border-slate-700 bg-slate-900/50 p-4">
        <h2 className="text-sm font-semibold text-slate-200">Institution</h2>
        <label className="mt-2 block text-sm text-slate-300">
          Name
          <input
            className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-2"
            value={program.institutionName}
            disabled={!canManage}
            onChange={(e) => setProgram({ ...program, institutionName: e.target.value })}
          />
        </label>
        <label className="mt-2 block text-sm text-slate-300">
          Timezone (IANA)
          <input
            className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-2"
            value={program.timezone}
            disabled={!canManage}
            onChange={(e) => setProgram({ ...program, timezone: e.target.value })}
          />
        </label>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {(
          [
            ["monthlySilent", "monthly_silent"],
            ["semesterAudible", "semester_audible"],
            ["annualComprehensive", "annual_comprehensive"],
          ] as const
        ).map(([key, kind]) => {
          const slot = program[key];
          return (
            <div key={key} className="rounded-lg border border-slate-700 p-3">
              <h3 className="text-sm font-semibold text-white">{ENS_TEST_KIND_LABELS[kind]}</h3>
              <label className="mt-2 flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={slot.enabled}
                  disabled={!canManage}
                  onChange={(e) =>
                    setProgram({ ...program, [key]: { ...slot, enabled: e.target.checked } })
                  }
                />
                Scheduled
              </label>
              <label className="mt-2 block text-xs text-slate-400">
                Local time (hour:minute)
                <input
                  className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1"
                  disabled={!canManage}
                  value={`${slot.hourLocal}:${String(slot.minuteLocal).padStart(2, "0")}`}
                  onChange={(e) => {
                    const [h, m] = e.target.value.split(":").map((x) => Number(x));
                    setProgram({
                      ...program,
                      [key]: {
                        ...slot,
                        hourLocal: Number.isFinite(h) ? h : slot.hourLocal,
                        minuteLocal: Number.isFinite(m) ? m : slot.minuteLocal,
                      },
                    });
                  }}
                />
              </label>
            </div>
          );
        })}
      </section>

      <section className="rounded-lg border border-slate-700 p-4">
        <h2 className="text-sm font-semibold text-slate-200">Property boundary & 1-mile ring</h2>
        <p className="mt-1 text-xs text-slate-500">
          One point per line: longitude,latitude (WGS84). Outer ring is computed automatically and synced to
          Amazon Location geofences when configured.
        </p>
        <textarea
          className="mt-2 min-h-[120px] w-full rounded border border-slate-600 bg-slate-950 px-2 py-2 font-mono text-xs"
          value={boundaryDraft}
          disabled={!canManage}
          onChange={(e) => setBoundaryDraft(e.target.value)}
        />
        {boundary?.outerRingOneMile?.length ? (
          <p className="mt-1 text-xs text-emerald-300/90">
            1-mile outer ring active ({boundary.outerRingOneMile.length} points).
          </p>
        ) : null}
        {canManage ? (
          <button
            type="button"
            disabled={saving}
            onClick={() => void saveBoundary()}
            className="mt-2 rounded bg-sky-700 px-3 py-2 text-sm text-white disabled:opacity-40"
          >
            Save boundary
          </button>
        ) : null}
      </section>

      {canManage ? (
        <button
          type="button"
          disabled={saving}
          onClick={() => void saveProgram()}
          className="rounded bg-sky-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save schedule & settings"}
        </button>
      ) : null}

      {canRun ? (
        <section className="rounded-lg border border-amber-700/50 bg-amber-950/20 p-4">
          <h2 className="text-sm font-semibold text-amber-100">Run test now</h2>
          <select
            className="mt-2 rounded border border-slate-600 bg-slate-950 px-2 py-2 text-sm"
            value={runKind}
            onChange={(e) => setRunKind(e.target.value as EnsTestKind)}
          >
            {(Object.keys(ENS_TEST_KIND_LABELS) as EnsTestKind[]).map((k) => (
              <option key={k} value={k}>
                {ENS_TEST_KIND_LABELS[k]}
              </option>
            ))}
          </select>
          <label className="mt-2 block text-sm text-slate-300">
            Type CONFIRM
            <input
              className="mt-1 w-full max-w-xs rounded border border-slate-600 bg-slate-950 px-2 py-2 uppercase"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </label>
          <button
            type="button"
            disabled={running || confirm.trim().toUpperCase() !== "CONFIRM"}
            onClick={() => void runTest()}
            className="mt-3 rounded bg-amber-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {running ? "Running…" : "Run ENS test"}
          </button>
        </section>
      ) : null}

      <section>
        <h2 className="text-sm font-semibold text-slate-200">Test history & Clery documentation</h2>
        <ul className="mt-2 space-y-2 text-sm">
          {runs.slice(0, 20).map((run) => (
            <li key={run.runId} className="flex flex-wrap items-center gap-2 rounded border border-slate-800 px-3 py-2">
              <span className="text-white">{ENS_TEST_KIND_LABELS[run.kind]}</span>
              <span className="text-slate-500">{new Date(run.initiatedAt).toLocaleString()}</span>
              <span className="text-slate-500">{run.scheduled ? "scheduled" : "manual"}</span>
              <a
                className="text-sky-400 hover:underline"
                href={`/api/alerts/ens/runs/${encodeURIComponent(run.runId)}/report?vertical=${encodeURIComponent(vertical)}`}
              >
                Download PDF
              </a>
              <Link className="text-sky-400 hover:underline" href={`${basePath}/${run.jobId}`}>
                Alert job
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
