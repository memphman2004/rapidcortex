"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DEMO_AGENCY_IDS,
  isDemoAgencyId,
  type QaSuiteResult,
  type ScenarioListItem,
  type ScenarioResult,
  type ScenarioVertical,
} from "rapid-cortex-shared";
import { useSession } from "@/components/auth/session-context";
import {
  fetchScenarioCenterCatalog,
  postDemoGenerate,
  postDemoQaSuite,
  postDemoReset,
  postDemoRunScenario,
} from "@/lib/api";

type TabId = "canned" | "ai" | "qa";

const VERTICALS: Array<{ id: ScenarioVertical; label: string }> = [
  { id: "campus", label: "Campus" },
  { id: "venue", label: "Venue" },
  { id: "transit", label: "Transit" },
  { id: "911", label: "PSAP" },
];

export function ScenarioCenter() {
  const { user } = useSession();
  const defaultAgency = useMemo(() => {
    if (user?.agencyId && isDemoAgencyId(user.agencyId)) return user.agencyId;
    return "test-agency";
  }, [user?.agencyId]);

  const [tab, setTab] = useState<TabId>("canned");
  const [agencyId, setAgencyId] = useState(defaultAgency);
  const [verticalFilter, setVerticalFilter] = useState<ScenarioVertical | "all">("all");
  const [catalog, setCatalog] = useState<ScenarioListItem[] | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [result, setResult] = useState<ScenarioResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [situation, setSituation] = useState("");
  const [aiVertical, setAiVertical] = useState<ScenarioVertical>("campus");
  const [qaVertical, setQaVertical] = useState<ScenarioVertical>("campus");
  const [qaReport, setQaReport] = useState<QaSuiteResult | null>(null);

  useEffect(() => {
    setAgencyId(defaultAgency);
  }, [defaultAgency]);

  const agencyLocked = user?.role === "agencyadmin";

  async function ensureCatalog() {
    if (catalog) return catalog;
    try {
      const items = await fetchScenarioCenterCatalog();
      setCatalog(items);
      setCatalogError(null);
      return items;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load scenarios";
      setCatalogError(message);
      return [];
    }
  }

  useEffect(() => {
    void ensureCatalog();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount
  }, []);

  async function runCanned(id: ScenarioListItem["id"]) {
    setBusyId(id);
    setError(null);
    setResult(null);
    try {
      const next = await postDemoRunScenario(id, agencyId);
      setResult(next);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Run failed");
    } finally {
      setBusyId(null);
    }
  }

  async function runGenerate() {
    setBusyId("ai-generated");
    setError(null);
    setResult(null);
    try {
      const next = await postDemoGenerate({ agencyId, situation, vertical: aiVertical });
      setResult(next.result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Generate failed");
    } finally {
      setBusyId(null);
    }
  }

  async function runQa() {
    setBusyId("qa-suite");
    setError(null);
    setQaReport(null);
    try {
      const report = await postDemoQaSuite({ agencyId, vertical: qaVertical });
      setQaReport(report);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "QA suite failed");
    } finally {
      setBusyId(null);
    }
  }

  async function resetAgency() {
    setBusyId("reset");
    setError(null);
    try {
      await postDemoReset(agencyId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setBusyId(null);
    }
  }

  const visible = (catalog ?? []).filter((s) => verticalFilter === "all" || s.vertical === verticalFilter);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-white">Scenario Center</h1>
        <p className="max-w-2xl text-sm text-slate-400">
          Run canned or AI-generated simulations on allowlisted demo agencies. Records are tagged{" "}
          <code className="text-slate-300">isDemoIncident</code>, dispatch is blocked, and they expire in two hours.
          Never use a production agency id.
        </p>
      </header>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs font-medium text-slate-400">
          Demo agency
          <select
            className="mt-1 block rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
            value={agencyId}
            disabled={agencyLocked}
            onChange={(e) => setAgencyId(e.target.value)}
          >
            {(agencyLocked ? [user?.agencyId ?? agencyId] : [...DEMO_AGENCY_IDS]).map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => void resetAgency()}
          disabled={busyId !== null}
          className="rounded-md border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"
        >
          {busyId === "reset" ? "Resetting…" : "Reset demo incidents"}
        </button>
      </div>

      <div className="flex gap-1 rounded-lg bg-slate-900 p-1">
        {(
          [
            ["canned", "Canned scenarios"],
            ["ai", "AI generator"],
            ["qa", "QA suite"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setTab(id);
              if (id === "canned") void ensureCatalog();
            }}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              tab === id ? "bg-slate-700 text-sky-300" : "text-slate-400 hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="rounded-md border border-red-500/40 bg-red-950/50 px-3 py-2 text-sm text-red-100">{error}</div>
      ) : null}

      {tab === "canned" ? (
        <section className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setVerticalFilter("all")}
              className={`rounded-full px-3 py-1 text-xs ${verticalFilter === "all" ? "bg-sky-800 text-white" : "bg-slate-800 text-slate-300"}`}
            >
              All
            </button>
            {VERTICALS.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setVerticalFilter(v.id)}
                className={`rounded-full px-3 py-1 text-xs ${
                  verticalFilter === v.id ? "bg-sky-800 text-white" : "bg-slate-800 text-slate-300"
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
          {catalog === null && !catalogError ? (
            <button
              type="button"
              className="text-sm text-sky-400 underline"
              onClick={() => void ensureCatalog()}
            >
              Load scenarios
            </button>
          ) : null}
          {catalogError ? <p className="text-sm text-red-300">{catalogError}</p> : null}
          <div className="grid gap-3 md:grid-cols-2">
            {visible.map((s) => (
              <article key={s.id} className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
                <h2 className="font-medium text-white">{s.label}</h2>
                <p className="mt-1 text-sm text-slate-400">{s.description}</p>
                <p className="mt-2 text-xs text-slate-500">
                  {s.estimatedDemoMinutes} min · {s.tags.join(" · ")}
                </p>
                <button
                  type="button"
                  disabled={busyId !== null}
                  onClick={() => void runCanned(s.id)}
                  className="mt-3 rounded-md bg-sky-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-600 disabled:opacity-50"
                >
                  {busyId === s.id ? "Running…" : "Run"}
                </button>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {tab === "ai" ? (
        <section className="space-y-3">
          <label className="block text-sm text-slate-300">
            Describe a situation
            <textarea
              value={situation}
              onChange={(e) => setSituation(e.target.value)}
              maxLength={500}
              rows={4}
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
              placeholder="Person with a weapon seen outside the library at midnight"
            />
          </label>
          <label className="text-xs font-medium text-slate-400">
            Vertical
            <select
              className="mt-1 block rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
              value={aiVertical}
              onChange={(e) => setAiVertical(e.target.value as ScenarioVertical)}
            >
              {VERTICALS.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={busyId !== null || !situation.trim()}
            onClick={() => void runGenerate()}
            className="rounded-md bg-sky-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-600 disabled:opacity-50"
          >
            {busyId === "ai-generated" ? "Generating…" : "Generate and run"}
          </button>
        </section>
      ) : null}

      {tab === "qa" ? (
        <section className="space-y-3">
          <p className="text-sm text-slate-400">
            Runs every canned scenario for the vertical, validates demo flags and TTL server-side, and resets between
            each run. Browser agents still cover UI checks.
          </p>
          <label className="text-xs font-medium text-slate-400">
            Vertical
            <select
              className="mt-1 block rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
              value={qaVertical}
              onChange={(e) => setQaVertical(e.target.value as ScenarioVertical)}
            >
              {VERTICALS.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={busyId !== null}
            onClick={() => void runQa()}
            className="rounded-md bg-sky-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-600 disabled:opacity-50"
          >
            {busyId === "qa-suite" ? "Running suite…" : `Run all ${qaVertical} scenarios`}
          </button>
          {qaReport ? (
            <div className="space-y-2">
              <p className="text-sm text-white">
                {qaReport.passed}/{qaReport.totalScenarios} passed ({qaReport.durationMs} ms)
              </p>
              <table className="w-full text-left text-sm text-slate-300">
                <thead>
                  <tr className="text-xs text-slate-500">
                    <th className="py-1">Scenario</th>
                    <th>Result</th>
                    <th>Failed checks</th>
                  </tr>
                </thead>
                <tbody>
                  {qaReport.scenarios.map((row) => (
                    <tr key={row.scenarioId} className="border-t border-slate-800">
                      <td className="py-1">{row.label}</td>
                      <td className={row.passed ? "text-emerald-400" : "text-red-400"}>
                        {row.passed ? "PASS" : "FAIL"}
                      </td>
                      <td className="text-xs text-slate-500">{row.failedChecks.join(", ") || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <a
                className="inline-block text-xs text-sky-400 underline"
                href={`data:application/json,${encodeURIComponent(JSON.stringify(qaReport, null, 2))}`}
                download={`qa-suite-${qaReport.vertical}.json`}
              >
                Download JSON report
              </a>
            </div>
          ) : null}
        </section>
      ) : null}

      {result ? <ResultPanel result={result} /> : null}
    </div>
  );
}

function ResultPanel({ result }: { result: ScenarioResult }) {
  return (
    <section className="rounded-lg border border-emerald-800/50 bg-emerald-950/20 p-4 text-sm text-slate-200">
      <h2 className="font-medium text-emerald-200">Scenario seeded</h2>
      <p className="mt-1 text-slate-400">
        {result.scenarioLabel} · {result.incidentType} · strategy {result.strategyUsed}
      </p>
      <p className="mt-2 font-mono text-xs text-slate-500">{result.incidentId}</p>
      <div className="mt-3 flex flex-wrap gap-3 text-sky-400">
        <a className="underline" href={result.dashboardUrl}>
          Dispatcher
        </a>
        <a className="underline" href={result.supervisorUrl}>
          Supervisor
        </a>
        <a className="underline" href={result.incidentDetailUrl}>
          Incident
        </a>
      </div>
      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-slate-400">Browser agent prompt</summary>
        <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-slate-950 p-2 text-xs text-slate-300">
          {result.browserAgentPrompt}
        </pre>
      </details>
    </section>
  );
}
