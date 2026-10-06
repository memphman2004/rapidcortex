"use client";

/**
 * NexiQ Intel — Source Registry
 * Target: apps/web/app/[jurisdiction]/nexiq/intel/sources/page.tsx
 *         + sources-client.tsx
 *
 * Admin UI to:
 *   - View all registered intelligence sources
 *   - Add new sources
 *   - Edit, disable, and run sources
 *   - View last run telemetry per source
 *   - See processing history for individual documents
 */

import { useState, Fragment } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  IntelligenceSource,
  IntelSourceRun,
  IntelDocument,
  CreateIntelligenceSourceRequest,
  IntelSourceHealth,
  IntelVertical,
  IntelSourceType,
  IntelConnectorType,
} from "rapid-cortex-shared/nexiq-intel";

const INTEL_API = "/api/rc-admin/nexiq/intel";

// ─── API ─────────────────────────────────────────────────────────────────────
async function fetchSources(
  health?: string,
  vertical?: string,
): Promise<{ sources: IntelligenceSource[] }> {
  const params = new URLSearchParams();
  if (health) params.set("health", health);
  if (vertical) params.set("vertical", vertical);
  const res = await fetch(`${INTEL_API}/sources?${params}`, { credentials: "include" });
  const body = await res.json() as { data: { sources: IntelligenceSource[] } };
  return body.data;
}

async function createSource(req: CreateIntelligenceSourceRequest): Promise<IntelligenceSource> {
  const res = await fetch(`${INTEL_API}/sources`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const err = await res.json() as { error: string };
    throw new Error(err.error ?? "Failed to create source");
  }
  const body = await res.json() as { data: IntelligenceSource };
  return body.data;
}

async function triggerRun(sourceId: string): Promise<void> {
  await fetch(`${INTEL_API}/sources/${sourceId}/run`, {
    method: "POST",
    credentials: "include",
  });
}

async function fetchRuns(sourceId: string): Promise<IntelSourceRun[]> {
  const res = await fetch(`${INTEL_API}/sources/${sourceId}/runs`, { credentials: "include" });
  const body = await res.json() as { data: { runs: IntelSourceRun[] } };
  return body.data.runs;
}

async function fetchSourceDocs(sourceId: string): Promise<IntelDocument[]> {
  const res = await fetch(`${INTEL_API}/sources/${sourceId}/documents`, { credentials: "include" });
  const body = await res.json() as { data: { documents: IntelDocument[] } };
  return body.data.documents;
}

// ─── Run Status Chip ─────────────────────────────────────────────────────────
function RunStatusChip({ status }: { status: IntelSourceRun["status"] }) {
  const styles: Record<IntelSourceRun["status"], string> = {
    RUNNING:  "bg-sky-500/10 text-sky-400",
    SUCCESS:  "bg-emerald-500/10 text-emerald-400",
    PARTIAL:  "bg-amber-500/10 text-amber-400",
    FAILED:   "bg-red-500/10 text-red-400",
    TIMEOUT:  "bg-red-500/10 text-red-400",
    SKIPPED:  "bg-slate-700/30 text-slate-500",
  };
  return (
    <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${styles[status] ?? "bg-slate-700/30 text-slate-500"}`}>
      {status}
    </span>
  );
}

function DocStatusChip({ status }: { status: IntelDocument["status"] }) {
  const color =
    status === "INBOX_CREATED" ? "text-emerald-400 bg-emerald-500/10" :
    status === "QUALIFIED" ? "text-sky-400 bg-sky-500/10" :
    status === "DISQUALIFIED" ? "text-red-400 bg-red-500/10" :
    status === "DUPLICATE" ? "text-slate-500 bg-slate-700/30" :
    status === "FAILED" ? "text-red-400 bg-red-500/10" :
    "text-slate-400 bg-slate-700/20";
  return (
    <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${color}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

// ─── Source Detail Drawer ─────────────────────────────────────────────────────
function SourceDetailDrawer({
  source,
  onClose,
}: {
  source: IntelligenceSource;
  onClose: () => void;
}) {
  const [drawerTab, setDrawerTab] = useState<"runs" | "docs">("runs");

  const runsQ = useQuery({
    queryKey: ["nexiq-intel-source-runs", source.sourceId],
    queryFn: () => fetchRuns(source.sourceId),
  });

  const docsQ = useQuery({
    queryKey: ["nexiq-intel-source-docs", source.sourceId],
    queryFn: () => fetchSourceDocs(source.sourceId),
    enabled: drawerTab === "docs",
  });

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
    <div
      className="fixed inset-0 z-50 flex"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="ml-auto flex h-full w-full max-w-2xl flex-col border-l border-slate-800 bg-[#070d17] shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 px-5 py-4">
          <div>
            <h3 className="font-bold text-slate-100">{source.name}</h3>
            <p className="mt-0.5 truncate text-xs text-slate-500">{source.url}</p>
          </div>
          <button
            onClick={onClose}
            className="ml-3 rounded p-1 text-slate-500 hover:text-slate-300"
          >
            ✕
          </button>
        </div>

        {/* Source meta */}
        <div className="grid grid-cols-3 gap-3 border-b border-slate-800 px-5 py-3">
          <div>
            <div className="text-[9px] font-bold tracking-widest text-slate-600 uppercase">Health</div>
            <div className="mt-0.5 text-xs text-slate-300">{source.health}</div>
          </div>
          <div>
            <div className="text-[9px] font-bold tracking-widest text-slate-600 uppercase">Connector</div>
            <div className="mt-0.5 font-mono text-xs text-slate-300">{source.connectorType}</div>
          </div>
          <div>
            <div className="text-[9px] font-bold tracking-widest text-slate-600 uppercase">Frequency</div>
            <div className="mt-0.5 text-xs text-slate-300">
              Every {source.checkFrequencyMinutes >= 60
                ? `${source.checkFrequencyMinutes / 60}h`
                : `${source.checkFrequencyMinutes}m`}
            </div>
          </div>
          <div>
            <div className="text-[9px] font-bold tracking-widest text-slate-600 uppercase">Last Attempt</div>
            <div className="mt-0.5 text-xs text-slate-300">{timeSince(source.lastAttemptAt)}</div>
          </div>
          <div>
            <div className="text-[9px] font-bold tracking-widest text-slate-600 uppercase">Last Success</div>
            <div className={`mt-0.5 text-xs ${!source.lastSuccessfulFetchAt ? "text-red-400" : "text-slate-300"}`}>
              {timeSince(source.lastSuccessfulFetchAt)}
            </div>
          </div>
          <div>
            <div className="text-[9px] font-bold tracking-widest text-slate-600 uppercase">Failures</div>
            <div className={`mt-0.5 text-xs font-bold ${
              (source.consecutiveFailures ?? 0) >= 5 ? "text-red-400" :
              (source.consecutiveFailures ?? 0) >= 2 ? "text-amber-400" : "text-slate-300"
            }`}>
              {source.consecutiveFailures ?? 0} consecutive
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800 px-5">
          {(["runs", "docs"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setDrawerTab(t)}
              className={`px-3 py-2.5 text-xs font-semibold transition-colors border-b-2 ${
                drawerTab === t
                  ? "border-sky-500 text-sky-400"
                  : "border-transparent text-slate-500 hover:text-slate-300"
              }`}
            >
              {t === "runs" ? "Recent Runs" : "Documents"}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {drawerTab === "runs" && (
            <div className="space-y-2">
              {runsQ.isLoading ? (
                <div className="py-8 text-center text-xs text-slate-500">Loading runs…</div>
              ) : runsQ.data?.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">No runs recorded yet.</div>
              ) : (
                runsQ.data?.map((run) => (
                  <div key={run.runId} className="rounded border border-slate-800 bg-slate-800/20 p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <RunStatusChip status={run.status} />
                        <span className="text-xs text-slate-400">
                          {new Date(run.startedAt).toLocaleString()}
                        </span>
                      </div>
                      <span className="font-mono text-[10px] text-slate-500">
                        {run.durationMs ? `${(run.durationMs / 1000).toFixed(1)}s` : "—"}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-4 gap-2 text-center">
                      {[
                        { v: run.documentsDiscovered, l: "Found" },
                        { v: run.newDocumentsFound, l: "New" },
                        { v: run.signalsDetected, l: "Signals" },
                        { v: run.opportunitiesCreated, l: "Created" },
                      ].map(({ v, l }) => (
                        <div
                          key={l}
                          className="flex min-h-[3.25rem] flex-col items-center justify-center rounded bg-slate-800/40 px-1 py-1.5 text-center"
                        >
                          <div className="w-full text-sm font-bold tabular-nums text-slate-200">{v}</div>
                          <div className="w-full text-[9px] text-slate-500">{l}</div>
                        </div>
                      ))}
                    </div>
                    {run.failureReason && (
                      <div className="mt-2 rounded bg-red-500/5 px-2 py-1 font-mono text-[10px] text-red-400">
                        {run.failureReason}
                      </div>
                    )}
                    <div className="mt-1 text-[9px] text-slate-600">
                      Triggered by: {run.triggeredBy}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {drawerTab === "docs" && (
            <div className="space-y-2">
              {docsQ.isLoading ? (
                <div className="py-8 text-center text-xs text-slate-500">Loading documents…</div>
              ) : docsQ.data?.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">No documents collected yet.</div>
              ) : (
                docsQ.data?.map((doc) => (
                  <div key={doc.docId} className="rounded border border-slate-800 bg-slate-800/20 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="min-w-0 flex-1 truncate text-xs font-medium text-slate-200">
                        {doc.title ?? doc.url}
                      </p>
                      <DocStatusChip status={doc.status} />
                    </div>
                    <p className="mt-0.5 truncate font-mono text-[10px] text-slate-500">{doc.url}</p>
                    <div className="mt-2 flex items-center gap-2 text-[9px] text-slate-600">
                      <span>{new Date(doc.collectedAt).toLocaleString()}</span>
                      {doc.isDuplicate && (
                        <span className="rounded bg-slate-700/50 px-1 py-0.5 text-slate-500">
                          DUP of {doc.duplicateOfDocId?.slice(0, 12)}
                        </span>
                      )}
                    </div>
                    {/* Processing history */}
                    {doc.processingHistory.length > 1 && (
                      <div className="mt-2 space-y-0.5">
                        {doc.processingHistory.map((h, i) => (
                          <div key={i} className="flex items-center gap-2 text-[9px] text-slate-600">
                            <span className="font-mono text-slate-700">
                              {new Date(h.at).toLocaleTimeString()}
                            </span>
                            <span className="text-slate-500">{h.stage}</span>
                            {h.error && <span className="text-red-500">{h.error.slice(0, 60)}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Add Source Modal ─────────────────────────────────────────────────────────
function AddSourceModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Partial<CreateIntelligenceSourceRequest>>({
    connectorType: "HTML",
    checkFrequencyMinutes: 120,
    verticals: [],
  });
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: createSource,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nexiq-intel-sources"] });
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  const SOURCE_TYPES: IntelSourceType[] = [
    "PROCUREMENT", "BOARD_AGENDA", "BOARD_MINUTES", "BUDGET", "CIP",
    "GRANT", "NEWS", "AWARD", "AGENCY", "VENDOR", "OTHER",
  ];

  const CONNECTOR_TYPES: IntelConnectorType[] = [
    "HTML", "RSS", "API", "PDF_INDEX", "SEARCH", "SITEMAP", "CUSTOM",
  ];

  const VERTICALS: IntelVertical[] = ["PSAP", "CAMPUS", "TRANSIT", "VENUE", "COMPETITOR"];

  function toggleVertical(v: IntelVertical) {
    setForm((f) => ({
      ...f,
      verticals: f.verticals?.includes(v)
        ? f.verticals.filter((x) => x !== v)
        : [...(f.verticals ?? []), v],
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.url || !form.sourceType || !form.connectorType || !form.verticals?.length) {
      setError("Please fill in all required fields and select at least one vertical.");
      return;
    }
    mutation.mutate(form as CreateIntelligenceSourceRequest);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg rounded-xl border border-slate-700 bg-[#070d17] shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <h3 className="font-bold text-slate-100">Add Intelligence Source</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">
                Name *
              </label>
              <input
                value={form.name ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Macon-Bibb County Procurement"
                className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 outline-none focus:border-sky-500"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">
                URL *
              </label>
              <input
                value={form.url ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                placeholder="https://procurement.example.gov/bids"
                className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 outline-none focus:border-sky-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">
                Source Type *
              </label>
              <select
                value={form.sourceType ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, sourceType: e.target.value as IntelSourceType }))}
                className="w-full rounded border border-slate-700 bg-slate-800 px-2 py-2 text-sm text-slate-100 outline-none"
              >
                <option value="">Select…</option>
                {SOURCE_TYPES.map((t) => (
                  <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">
                Connector *
              </label>
              <select
                value={form.connectorType ?? "HTML"}
                onChange={(e) => setForm((f) => ({ ...f, connectorType: e.target.value as IntelConnectorType }))}
                className="w-full rounded border border-slate-700 bg-slate-800 px-2 py-2 text-sm text-slate-100 outline-none"
              >
                {CONNECTOR_TYPES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
              Verticals * (select all that apply)
            </label>
            <div className="flex flex-wrap gap-2">
              {VERTICALS.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => toggleVertical(v)}
                  className={`rounded px-3 py-1.5 text-xs font-semibold transition-colors ${
                    form.verticals?.includes(v)
                      ? "bg-sky-500 text-white"
                      : "border border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">
                Organization
              </label>
              <input
                value={form.organization ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, organization: e.target.value }))}
                placeholder="Macon-Bibb County"
                className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">
                Check Frequency
              </label>
              <select
                value={form.checkFrequencyMinutes ?? 120}
                onChange={(e) => setForm((f) => ({ ...f, checkFrequencyMinutes: parseInt(e.target.value, 10) }))}
                className="w-full rounded border border-slate-700 bg-slate-800 px-2 py-2 text-sm text-slate-100 outline-none"
              >
                <option value={120}>Every 2 hours</option>
                <option value={30}>Every 30 min</option>
                <option value={60}>Every hour</option>
                <option value={360}>Every 6 hours</option>
                <option value={720}>Every 12 hours</option>
                <option value={1440}>Daily</option>
                <option value={10080}>Weekly</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">
              Document Link Pattern (optional)
            </label>
            <input
              value={form.documentLinkPattern ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, documentLinkPattern: e.target.value }))}
              placeholder="e.g. /bids/|solicitation|rfp"
              className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 font-mono text-sm text-slate-100 placeholder-slate-600 outline-none focus:border-sky-500"
            />
            <p className="mt-1 text-[10px] text-slate-600">
              Regex pattern for filtering document links. Leave empty for default procurement link detection.
            </p>
          </div>

          {error && (
            <div className="rounded bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="rounded bg-sky-600 px-4 py-2 text-xs font-bold text-white hover:bg-sky-500 disabled:opacity-60"
            >
              {mutation.isPending ? "Adding…" : "Add Source"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function NexiQIntelSourcesPage() {
  const [healthFilter, setHealthFilter] = useState<string>("");
  const [verticalFilter, setVerticalFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [selectedSource, setSelectedSource] = useState<IntelligenceSource | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);

  const sourcesQ = useQuery({
    queryKey: ["nexiq-intel-sources", healthFilter, verticalFilter],
    queryFn: () => fetchSources(healthFilter || undefined, verticalFilter || undefined),
    refetchInterval: 30_000,
  });

  const sources = (sourcesQ.data?.sources ?? []).filter((s) => {
    if (!search) return true;
    const hay = `${s.name} ${s.url} ${s.organization ?? ""}`.toLowerCase();
    return hay.includes(search.toLowerCase());
  });

  async function handleRunNow(sourceId: string) {
    setRunningId(sourceId);
    await triggerRun(sourceId).catch(() => {});
    setTimeout(() => {
      setRunningId(null);
      sourcesQ.refetch();
    }, 2000);
  }

  const counts = {
    total: sourcesQ.data?.sources.length ?? 0,
    failing: sourcesQ.data?.sources.filter((s) => s.health === "FAILING").length ?? 0,
    degraded: sourcesQ.data?.sources.filter((s) => s.health === "DEGRADED").length ?? 0,
    disabled: sourcesQ.data?.sources.filter((s) => s.health === "DISABLED").length ?? 0,
  };

  return (
    <div className="min-h-screen bg-[#03060b] text-slate-100">
      {/* Header */}
      <div className="border-b border-slate-800 bg-[#070d17] px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="rounded bg-sky-500 px-2 py-0.5 text-xs font-black text-white">NXQ</span>
          <div>
            <h1 className="text-base font-bold">Source Registry</h1>
            <p className="text-xs text-slate-500">
              {counts.total} registered · {counts.failing > 0 ? `${counts.failing} failing · ` : ""}
              {counts.degraded > 0 ? `${counts.degraded} degraded · ` : ""}
              {counts.disabled > 0 ? `${counts.disabled} disabled` : ""}
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="ml-auto rounded bg-sky-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-sky-500 transition-colors"
          >
            + Add Source
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-800 bg-[#07101d] px-6 py-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search sources…"
          className="rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-600 outline-none focus:border-sky-500"
        />
        <select
          value={healthFilter}
          onChange={(e) => setHealthFilter(e.target.value)}
          className="rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-200 outline-none"
        >
          <option value="">All Health</option>
          <option value="FAILING">Failing</option>
          <option value="DEGRADED">Degraded</option>
          <option value="HEALTHY">Healthy</option>
          <option value="DISABLED">Disabled</option>
        </select>
        <select
          value={verticalFilter}
          onChange={(e) => setVerticalFilter(e.target.value)}
          className="rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-200 outline-none"
        >
          <option value="">All Verticals</option>
          <option value="PSAP">PSAP / 911</option>
          <option value="CAMPUS">Campus</option>
          <option value="TRANSIT">Transit</option>
          <option value="VENUE">Venue</option>
          <option value="COMPETITOR">Competitor</option>
        </select>
        <span className="ml-auto text-xs text-slate-500">{sources.length} sources</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="border-b border-slate-800 text-[10px] font-bold tracking-widest text-slate-500 uppercase">
              <th className="px-4 py-3 text-left">Source</th>
              <th className="px-4 py-3 text-left">Verticals</th>
              <th className="px-4 py-3 text-left">Type / Connector</th>
              <th className="px-4 py-3 text-left">Health</th>
              <th className="px-4 py-3 text-right">Last Success</th>
              <th className="px-4 py-3 text-right">Failures</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {sourcesQ.isLoading ? (
              <tr>
                <td colSpan={7} className="py-16 text-center text-sm text-slate-500">
                  Loading sources…
                </td>
              </tr>
            ) : sources.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-16 text-center text-sm text-slate-500">
                  {search || healthFilter || verticalFilter
                    ? "No sources match the current filter."
                    : "No sources registered yet. Add one to get started."}
                </td>
              </tr>
            ) : (
              sources.map((s) => (
                <tr
                  key={s.sourceId}
                  onClick={() => setSelectedSource(s)}
                  className="cursor-pointer hover:bg-slate-800/20 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="max-w-[280px]">
                      <div className="truncate font-medium text-slate-200">{s.name}</div>
                      {s.organization && (
                        <div className="mt-0.5 truncate text-[10px] text-slate-500">{s.organization}</div>
                      )}
                      <div className="mt-0.5 truncate font-mono text-[10px] text-slate-600">{s.url}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {s.verticals.map((v) => {
                        const styles: Record<IntelVertical, string> = {
                          PSAP: "bg-sky-500/10 text-sky-400",
                          CAMPUS: "bg-violet-500/10 text-violet-400",
                          TRANSIT: "bg-amber-500/10 text-amber-400",
                          VENUE: "bg-rose-500/10 text-rose-400",
                          COMPETITOR: "bg-slate-500/10 text-slate-400",
                        };
                        return (
                          <span key={v} className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${styles[v]}`}>
                            {v}
                          </span>
                        );
                      })}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-[10px] text-slate-400">
                    <div>{s.sourceType.replace(/_/g, " ")}</div>
                    <div className="text-slate-600">{s.connectorType}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold ${
                      s.health === "HEALTHY" ? "bg-emerald-500/10 text-emerald-400" :
                      s.health === "DEGRADED" ? "bg-amber-500/10 text-amber-400" :
                      s.health === "FAILING" ? "bg-red-500/10 text-red-400" :
                      "bg-slate-700/30 text-slate-500"
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${
                        s.health === "HEALTHY" ? "bg-emerald-400" :
                        s.health === "DEGRADED" ? "bg-amber-400" :
                        s.health === "FAILING" ? "bg-red-400 animate-pulse" :
                        "bg-slate-500"
                      }`} />
                      {s.health}
                    </div>
                  </td>
                  <td className={`px-4 py-3 text-right ${
                    !s.lastSuccessfulFetchAt ? "text-red-400" :
                    (Date.now() - new Date(s.lastSuccessfulFetchAt).getTime()) > 86400000
                      ? "text-amber-400" : "text-slate-400"
                  }`}>
                    {s.lastSuccessfulFetchAt
                      ? new Date(s.lastSuccessfulFetchAt).toLocaleString()
                      : "Never"}
                  </td>
                  <td className={`px-4 py-3 text-right font-mono ${
                    (s.consecutiveFailures ?? 0) >= 5 ? "text-red-400 font-bold" :
                    (s.consecutiveFailures ?? 0) >= 2 ? "text-amber-400" : "text-slate-500"
                  }`}>
                    {s.consecutiveFailures ?? 0}
                  </td>
                  <td
                    className="px-4 py-3 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => handleRunNow(s.sourceId)}
                      disabled={runningId === s.sourceId || !s.enabled}
                      className="rounded border border-sky-500/30 bg-sky-500/10 px-2 py-1 text-[10px] font-semibold text-sky-400 
                                 hover:bg-sky-500/20 disabled:opacity-40 transition-colors"
                    >
                      {runningId === s.sourceId ? "⟳" : "Run"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modals / Drawers */}
      {selectedSource && (
        <SourceDetailDrawer
          source={selectedSource}
          onClose={() => setSelectedSource(null)}
        />
      )}
      {showAddModal && <AddSourceModal onClose={() => setShowAddModal(false)} />}
    </div>
  );
}
