"use client";

/**
 * NexiQ Intel — Coverage Dashboard
 * Target: apps/web/app/[jurisdiction]/nexiq/intel/coverage/page.tsx
 *         apps/web/app/[jurisdiction]/nexiq/intel/coverage/coverage-client.tsx
 *
 * Answers: "Is NexiQ actually looking where it is supposed to look?"
 * NOT primarily a sales dashboard — this is operational health for the pipeline.
 *
 * A zero-result SUCCESS is shown differently from a FAILURE.
 */

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type {
  IntelCoverageSnapshot,
  IntelligenceSource,
  IntelSourceRun,
  IntelSourceHealth,
  IntelVertical,
} from "rapid-cortex-shared/nexiq-intel";

const INTEL_API = "/api/rc-admin/nexiq/intel";

// ─── API ─────────────────────────────────────────────────────────────────────
async function fetchCoverage(): Promise<IntelCoverageSnapshot> {
  const res = await fetch(`${INTEL_API}/coverage`, { credentials: "include" });
  const body = await res.json() as { data: IntelCoverageSnapshot };
  return body.data;
}

async function fetchSources(
  health?: IntelSourceHealth,
  vertical?: IntelVertical,
): Promise<{ sources: IntelligenceSource[]; total: number }> {
  const params = new URLSearchParams();
  if (health) params.set("health", health);
  if (vertical) params.set("vertical", vertical);
  const res = await fetch(`${INTEL_API}/sources?${params}`, { credentials: "include" });
  const body = await res.json() as { data: { sources: IntelligenceSource[]; total: number } };
  return body.data;
}

async function triggerRun(sourceId: string): Promise<void> {
  await fetch(`${INTEL_API}/sources/${sourceId}/run`, {
    method: "POST",
    credentials: "include",
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function MetricTile({
  value,
  label,
  color = "text-slate-100",
  subtext,
}: {
  value: string | number;
  label: string;
  color?: string;
  subtext?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-[#0c1528] px-5 py-4">
      <div className={`text-3xl font-bold leading-none tracking-tight ${color}`}>
        {value}
      </div>
      <div className="mt-1 text-[10px] font-bold tracking-widest text-slate-500 uppercase">
        {label}
      </div>
      {subtext && (
        <div className="mt-1 text-xs text-slate-600">{subtext}</div>
      )}
    </div>
  );
}

function HealthBadge({ health }: { health: IntelSourceHealth }) {
  const styles: Record<IntelSourceHealth, string> = {
    HEALTHY:  "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
    DEGRADED: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
    FAILING:  "bg-red-500/10 text-red-400 border border-red-500/20",
    DISABLED: "bg-slate-700/30 text-slate-500 border border-slate-700/40",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold ${styles[health]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${
        health === "HEALTHY" ? "bg-emerald-400" :
        health === "DEGRADED" ? "bg-amber-400" :
        health === "FAILING" ? "bg-red-400 animate-pulse" :
        "bg-slate-500"
      }`} />
      {health}
    </span>
  );
}

function VerticalBadge({ vertical }: { vertical: IntelVertical }) {
  const styles: Record<IntelVertical, string> = {
    PSAP:       "bg-sky-500/10 text-sky-400",
    CAMPUS:     "bg-violet-500/10 text-violet-400",
    TRANSIT:    "bg-amber-500/10 text-amber-400",
    VENUE:      "bg-rose-500/10 text-rose-400",
    COMPETITOR: "bg-slate-500/10 text-slate-400",
  };
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-bold ${styles[vertical]}`}>
      {vertical}
    </span>
  );
}

function ProgressBar({
  value,
  max,
  color = "bg-sky-500",
}: {
  value: number;
  max: number;
  color?: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-slate-800">
      <div
        className={`h-full rounded-full transition-all ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ─── Source Health Table ──────────────────────────────────────────────────────
function SourceHealthTable({
  sources,
  onRunNow,
  runningSourceId,
}: {
  sources: IntelligenceSource[];
  onRunNow: (sourceId: string) => void;
  runningSourceId: string | null;
}) {
  function timeSince(iso?: string): string {
    if (!iso) return "Never";
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="border-b border-slate-800 text-[10px] font-bold tracking-widest text-slate-500 uppercase">
            <th className="px-3 py-2 text-left">Source</th>
            <th className="px-3 py-2 text-left">Vertical</th>
            <th className="px-3 py-2 text-left">Type</th>
            <th className="px-3 py-2 text-left">State</th>
            <th className="px-3 py-2 text-right">Last Attempt</th>
            <th className="px-3 py-2 text-right">Last Success</th>
            <th className="px-3 py-2 text-right">Failures</th>
            <th className="px-3 py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60">
          {sources.map((s) => (
            <tr key={s.sourceId} className="group hover:bg-slate-800/20">
              <td className="px-3 py-2">
                <div className="max-w-[220px]">
                  <div className="truncate font-medium text-slate-200">{s.name}</div>
                  <div className="mt-0.5 truncate text-[10px] text-slate-500">{s.url}</div>
                </div>
              </td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap gap-1">
                  {s.verticals.map((v) => (
                    <VerticalBadge key={v} vertical={v} />
                  ))}
                </div>
              </td>
              <td className="px-3 py-2 font-mono text-[10px] text-slate-400">
                {s.connectorType}
              </td>
              <td className="px-3 py-2">
                <HealthBadge health={s.health} />
              </td>
              <td className="px-3 py-2 text-right text-slate-400">
                {timeSince(s.lastAttemptAt)}
              </td>
              <td className={`px-3 py-2 text-right ${
                !s.lastSuccessfulFetchAt ? "text-red-400" :
                (Date.now() - new Date(s.lastSuccessfulFetchAt).getTime()) > 3 * 24 * 60 * 60 * 1000
                  ? "text-amber-400" : "text-slate-400"
              }`}>
                {timeSince(s.lastSuccessfulFetchAt)}
              </td>
              <td className={`px-3 py-2 text-right font-mono ${
                (s.consecutiveFailures ?? 0) >= 5 ? "text-red-400 font-bold" :
                (s.consecutiveFailures ?? 0) >= 2 ? "text-amber-400" : "text-slate-500"
              }`}>
                {s.consecutiveFailures ?? 0}
              </td>
              <td className="px-3 py-2 text-right">
                <button
                  onClick={() => onRunNow(s.sourceId)}
                  disabled={runningSourceId === s.sourceId || !s.enabled}
                  className="rounded border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold text-sky-400 
                             hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
                >
                  {runningSourceId === s.sourceId ? "⟳" : "Run Now"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {sources.length === 0 && (
        <div className="py-12 text-center text-sm text-slate-500">
          No sources match the current filter.
        </div>
      )}
    </div>
  );
}

// ─── Coverage Snapshot Panel ─────────────────────────────────────────────────
function CoverageSnapshotPanel({ snapshot }: { snapshot: IntelCoverageSnapshot }) {
  const successRate = snapshot.sourceSuccessRate.toFixed(1);
  const rateColor =
    snapshot.sourceSuccessRate >= 95
      ? "text-emerald-400"
      : snapshot.sourceSuccessRate >= 85
        ? "text-amber-400"
        : "text-red-400";

  return (
    <div className="space-y-4">
      {/* Pipeline funnel */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricTile
          value={snapshot.registeredSources.toLocaleString()}
          label="Registered Sources"
          color="text-slate-200"
        />
        <MetricTile
          value={snapshot.sourcesChecked.toLocaleString()}
          label="Sources Checked"
          color="text-sky-400"
          subtext={`of ${snapshot.sourcesScheduled} scheduled`}
        />
        <MetricTile
          value={`${successRate}%`}
          label="Source Success Rate"
          color={rateColor}
          subtext={`${snapshot.sourcesFailed} failed`}
        />
        <MetricTile
          value={snapshot.qualifiedOpportunities}
          label="Qualified Opportunities"
          color="text-emerald-400"
          subtext={`${snapshot.highPriorityOpportunities} high priority`}
        />
      </div>

      {/* Document pipeline */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricTile
          value={snapshot.documentsDiscovered.toLocaleString()}
          label="Documents Discovered"
          color="text-slate-300"
        />
        <MetricTile
          value={snapshot.newDocuments.toLocaleString()}
          label="New Documents"
          color="text-slate-300"
          subtext="not previously seen"
        />
        <MetricTile
          value={snapshot.documentsProcessed.toLocaleString()}
          label="Documents Processed"
          color="text-slate-300"
          subtext={snapshot.processingFailures > 0 ? `${snapshot.processingFailures} failed` : undefined}
        />
        <MetricTile
          value={snapshot.relevantSignals}
          label="Relevant Signals"
          color="text-violet-400"
          subtext={`of ${snapshot.potentialSignals} potential`}
        />
      </div>

      {/* Vertical breakdown */}
      <div className="rounded-lg border border-slate-800 bg-[#0c1528] p-4">
        <div className="mb-3 text-[10px] font-bold tracking-widest text-slate-500 uppercase">
          By Vertical
        </div>
        <div className="space-y-3">
          {(["PSAP", "CAMPUS", "TRANSIT", "VENUE", "COMPETITOR"] as IntelVertical[]).map((v) => {
            const vd = snapshot.byVertical[v];
            return (
              <div key={v} className="flex items-center gap-3">
                <VerticalBadge vertical={v} />
                <div className="flex flex-1 items-center gap-3">
                  <div className="w-12 text-right text-xs font-medium text-slate-400">
                    {vd.sources}
                  </div>
                  <div className="flex-1">
                    <ProgressBar
                      value={vd.sources}
                      max={snapshot.registeredSources}
                      color="bg-sky-500/60"
                    />
                  </div>
                  <div className="w-20 text-right text-xs text-slate-500">
                    {vd.signals} signals · {vd.opportunities} opp
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function NexiQIntelCoveragePage() {
  const [healthFilter, setHealthFilter] = useState<IntelSourceHealth | "">("");
  const [verticalFilter, setVerticalFilter] = useState<IntelVertical | "">("");
  const [runningSourceId, setRunningSourceId] = useState<string | null>(null);
  const [tab, setTab] = useState<"coverage" | "sources">("coverage");

  const coverageQ = useQuery({
    queryKey: ["nexiq-intel-coverage"],
    queryFn: fetchCoverage,
    refetchInterval: 60_000,
  });

  const sourcesQ = useQuery({
    queryKey: ["nexiq-intel-sources", healthFilter, verticalFilter],
    queryFn: () =>
      fetchSources(
        healthFilter || undefined,
        verticalFilter || undefined,
      ),
    staleTime: 30_000,
  });

  async function handleRunNow(sourceId: string) {
    setRunningSourceId(sourceId);
    try {
      await triggerRun(sourceId);
    } finally {
      setTimeout(() => setRunningSourceId(null), 3000);
    }
  }

  const failingSources = (sourcesQ.data?.sources ?? []).filter(
    (s) => s.health === "FAILING",
  );
  const degradedSources = (sourcesQ.data?.sources ?? []).filter(
    (s) => s.health === "DEGRADED",
  );

  return (
    <div className="min-h-screen bg-[#03060b] text-slate-100">
      {/* Header */}
      <div className="border-b border-slate-800 bg-[#070d17] px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="rounded bg-sky-500 px-2 py-0.5 text-xs font-black text-white">NXQ</span>
          <div>
            <h1 className="text-base font-bold text-slate-100">
              Intelligence Coverage
            </h1>
            <p className="text-xs text-slate-500">
              Is NexiQ actually looking where it is supposed to look?
            </p>
          </div>
          {coverageQ.data && (
            <div className="ml-auto text-right">
              <div className="text-xs text-slate-500">
                {new Date(coverageQ.data.createdAt).toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-600">Today&apos;s snapshot</div>
            </div>
          )}
        </div>
      </div>

      {/* Failure alerts */}
      {failingSources.length > 0 && (
        <div className="border-b border-red-500/20 bg-red-500/5 px-6 py-3">
          <p className="text-xs font-semibold text-red-400">
            ⚠ {failingSources.length} source{failingSources.length > 1 ? "s" : ""} FAILING:{" "}
            {failingSources
              .slice(0, 3)
              .map((s) => s.name)
              .join(", ")}
            {failingSources.length > 3 && ` +${failingSources.length - 3} more`}
          </p>
        </div>
      )}
      {degradedSources.length > 0 && failingSources.length === 0 && (
        <div className="border-b border-amber-500/20 bg-amber-500/5 px-6 py-3">
          <p className="text-xs font-semibold text-amber-400">
            ⚡ {degradedSources.length} source{degradedSources.length > 1 ? "s" : ""} degraded
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-slate-800 px-6">
        <div className="flex gap-0">
          {(["coverage", "sources"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-3 text-xs font-semibold transition-colors border-b-2 ${
                tab === t
                  ? "border-sky-500 text-sky-400"
                  : "border-transparent text-slate-500 hover:text-slate-300"
              }`}
            >
              {t === "coverage" ? "Coverage Snapshot" : `Source Health (${sourcesQ.data?.total ?? "…"})`}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {tab === "coverage" && (
          <>
            {coverageQ.isLoading && (
              <div className="text-center text-sm text-slate-500 py-12">Loading coverage data…</div>
            )}
            {coverageQ.error && (
              <div className="text-center text-sm text-red-400 py-12">
                Failed to load coverage data.{" "}
                <button onClick={() => coverageQ.refetch()} className="underline">Retry</button>
              </div>
            )}
            {coverageQ.data && <CoverageSnapshotPanel snapshot={coverageQ.data} />}
          </>
        )}

        {tab === "sources" && (
          <>
            {/* Filters */}
            <div className="mb-4 flex items-center gap-3 flex-wrap">
              <select
                value={healthFilter}
                onChange={(e) => setHealthFilter(e.target.value as IntelSourceHealth | "")}
                className="rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-200 outline-none"
              >
                <option value="">All Health States</option>
                <option value="FAILING">⛔ FAILING</option>
                <option value="DEGRADED">⚠ DEGRADED</option>
                <option value="HEALTHY">✓ HEALTHY</option>
                <option value="DISABLED">○ DISABLED</option>
              </select>
              <select
                value={verticalFilter}
                onChange={(e) => setVerticalFilter(e.target.value as IntelVertical | "")}
                className="rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-200 outline-none"
              >
                <option value="">All Verticals</option>
                <option value="PSAP">PSAP / 911</option>
                <option value="CAMPUS">Campus</option>
                <option value="TRANSIT">Transit</option>
                <option value="VENUE">Venue</option>
                <option value="COMPETITOR">Competitor</option>
              </select>
              <div className="ml-auto text-xs text-slate-500">
                {sourcesQ.data?.total ?? 0} sources
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-[#0c1528] overflow-hidden">
              {sourcesQ.isLoading ? (
                <div className="py-12 text-center text-sm text-slate-500">Loading sources…</div>
              ) : (
                <SourceHealthTable
                  sources={
                    healthFilter === "FAILING"
                      ? failingSources
                      : healthFilter === "DEGRADED"
                        ? degradedSources
                        : (sourcesQ.data?.sources ?? []).filter((s) =>
                            !healthFilter || s.health === healthFilter
                          )
                  }
                  onRunNow={handleRunNow}
                  runningSourceId={runningSourceId}
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
