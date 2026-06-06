"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchSeoIssues,
  fetchSeoOverview,
  fetchSeoSettings,
  generateSeoSchemaSnippet,
  getSeoSitemapReport,
  patchSeoIssueStatus,
  postSeoCompetitorOutline,
  postSeoKeywordIntel,
  postSeoPageScan,
  postSeoSuggestions,
} from "@/lib/api";
import { isSeoIntelligenceUiEnabled } from "@/lib/runtime-flags";

type Overview = Awaited<ReturnType<typeof fetchSeoOverview>>;

export default function CortexSeoIntelligencePage() {
  const enabled = useMemo(() => isSeoIntelligenceUiEnabled(), []);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [flags, setFlags] = useState<{ seoAiSuggestionsEnabled?: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [scanUrl, setScanUrl] = useState("https://www.rapidcortex.us/");
  const [kwUrl, setKwUrl] = useState("https://www.rapidcortex.us/");
  const [kwText, setKwText] = useState("911 dispatch software");
  const [suggestUrl, setSuggestUrl] = useState("https://www.rapidcortex.us/");
  const [schemaType, setSchemaType] = useState<
    "Organization" | "SoftwareApplication" | "FAQPage" | "Article" | "BreadcrumbList" | "Product" | "LocalBusiness"
  >("Organization");
  const [schemaPayload, setSchemaPayload] = useState(
    JSON.stringify({ name: "Rapid Cortex", url: "https://www.rapidcortex.us" }, null, 2),
  );
  const [originCheck, setOriginCheck] = useState("https://www.rapidcortex.us");
  const [toolOutput, setToolOutput] = useState<string | null>(null);

  const [topicId, setTopicId] = useState<
    | "rapid-cortex-vs-legacy-cad"
    | "rapid-cortex-vs-ng911-media-only"
    | "rc-lite-api-cad-vendors"
    | "emergency-response-intelligence"
    | "911-dispatcher-decision-support"
  >("rapid-cortex-vs-legacy-cad");

  const refresh = useCallback(async () => {
    setError(null);
    const [o, s] = await Promise.all([fetchSeoOverview(), fetchSeoSettings()]);
    setOverview(o);
    setFlags(s);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void refresh().catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, [enabled, refresh]);

  if (!enabled) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-slate-200">
        <h1 className="text-xl font-semibold text-white">Cortex SEO Intelligence</h1>
        <p className="mt-3 text-sm text-slate-400">
          This internal dashboard is disabled. Set{" "}
          <code className="rounded bg-slate-900 px-1 py-0.5 text-slate-300">NEXT_PUBLIC_ENABLE_SEO_INTELLIGENCE=1</code>{" "}
          for environments that ship the SEO Intelligence API.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-10 px-4 py-8 text-slate-200">
      <header className="space-y-2 border-b border-slate-800 pb-6">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-400/90">Internal admin</p>
        <h1 className="text-2xl font-semibold text-white">Cortex SEO Intelligence</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-slate-400">
          Scan public marketing pages, review structured findings, generate metadata and JSON-LD ideas, and track issues —
          without exposing vendor-specific AI branding in the UI.
        </p>
        {flags ? (
          <p className="text-xs text-slate-500">
            AI-assisted packs: {flags.seoAiSuggestionsEnabled ? "enabled server-side" : "rule-based fallback"} · Schedule
            automation respects <code className="text-slate-400">SEO_AUTO_SCAN_ENABLED</code>
          </p>
        ) : null}
      </header>

      {error ? (
        <div className="rounded-lg border border-rose-900/60 bg-rose-950/30 px-4 py-3 text-sm text-rose-100">{error}</div>
      ) : null}

      <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-5">
        <h2 className="text-lg font-medium text-white">SEO overview</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Stat label="Stored scans" value={overview?.scanCount ?? "—"} />
          <Stat label="Open issues" value={overview?.openIssues ?? "—"} />
          <Stat label="Last scan" value={overview?.lastScanAt ? formatIso(overview.lastScanAt) : "—"} />
        </div>
        <button
          type="button"
          className="mt-4 rounded-lg bg-slate-800 px-3 py-2 text-xs font-medium text-slate-100 hover:bg-slate-700"
          onClick={() => refresh().catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))}
        >
          Refresh overview
        </button>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-5">
        <h2 className="text-lg font-medium text-white">Scan a page</h2>
        <p className="mt-1 text-xs text-slate-500">
          Only public <span className="text-slate-400">http(s)</span> URLs are accepted; private networks are blocked at
          the API.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-1 text-xs text-slate-400">
            Page URL
            <input
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none ring-sky-500/40 focus:ring-2"
              value={scanUrl}
              onChange={(e) => setScanUrl(e.target.value)}
            />
          </label>
          <button
            type="button"
            disabled={busy}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await postSeoPageScan({ url: scanUrl.trim() });
                await refresh();
              } catch (e: unknown) {
                setError(e instanceof Error ? e.message : String(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            Run scan
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-5">
        <h2 className="text-lg font-medium text-white">Page reports</h2>
        <ul className="mt-4 divide-y divide-slate-800 rounded-lg border border-slate-800">
          {(overview?.recentScans ?? []).length === 0 ? (
            <li className="px-4 py-6 text-sm text-slate-500">No scans stored yet.</li>
          ) : (
            overview!.recentScans!.map((s) => (
              <li key={s.id} className="flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="truncate font-medium text-slate-100">{s.pageTitle || "(no title)"}</div>
                  <div className="truncate text-xs text-slate-500">{s.url}</div>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-xs">
                  <span className="rounded-md bg-slate-900 px-2 py-1 text-sky-300">Score {s.score}</span>
                  <span className="text-slate-500">{s.scanStatus}</span>
                </div>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-5">
        <h2 className="text-lg font-medium text-white">Keyword planner</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-slate-400">
            URL
            <input
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none ring-sky-500/40 focus:ring-2"
              value={kwUrl}
              onChange={(e) => setKwUrl(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-400">
            Keywords (comma-separated)
            <input
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none ring-sky-500/40 focus:ring-2"
              value={kwText}
              onChange={(e) => setKwText(e.target.value)}
            />
          </label>
        </div>
        <button
          type="button"
          className="mt-4 rounded-lg bg-slate-800 px-3 py-2 text-xs font-medium text-slate-100 hover:bg-slate-700"
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              const kws = kwText
                .split(",")
                .map((k) => k.trim())
                .filter(Boolean);
              const res = await postSeoKeywordIntel({ url: kwUrl.trim(), keywords: kws });
              setToolOutput(JSON.stringify(res, null, 2));
            } catch (e: unknown) {
              setError(e instanceof Error ? e.message : String(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          Analyze keywords (shows JSON)
        </button>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-5">
        <h2 className="text-lg font-medium text-white">SEO Intelligence Suggestions</h2>
        <p className="mt-1 text-xs text-slate-500">
          Output is labeled generically — never ties to a specific cloud AI vendor in the UI.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-1 text-xs text-slate-400">
            URL
            <input
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none ring-sky-500/40 focus:ring-2"
              value={suggestUrl}
              onChange={(e) => setSuggestUrl(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                const res = await postSeoSuggestions({ url: suggestUrl.trim() });
                setToolOutput(JSON.stringify(res, null, 2));
              } catch (e: unknown) {
                setError(e instanceof Error ? e.message : String(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            Generate suggestions
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-5">
        <h2 className="text-lg font-medium text-white">Schema generator</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <label className="flex flex-col gap-1 text-xs text-slate-400">
            Type
            <select
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none ring-sky-500/40 focus:ring-2"
              value={schemaType}
              onChange={(e) => setSchemaType(e.target.value as typeof schemaType)}
            >
              <option value="Organization">Organization</option>
              <option value="SoftwareApplication">SoftwareApplication</option>
              <option value="Product">Product</option>
              <option value="FAQPage">FAQPage</option>
              <option value="LocalBusiness">LocalBusiness</option>
              <option value="Article">Article</option>
              <option value="BreadcrumbList">BreadcrumbList</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-400 lg:col-span-2">
            Payload (JSON)
            <textarea
              className="min-h-[140px] rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-xs text-slate-100 outline-none ring-sky-500/40 focus:ring-2"
              value={schemaPayload}
              onChange={(e) => setSchemaPayload(e.target.value)}
            />
          </label>
        </div>
        <button
          type="button"
          className="mt-4 rounded-lg bg-slate-800 px-3 py-2 text-xs font-medium text-slate-100 hover:bg-slate-700"
          onClick={async () => {
            setError(null);
            try {
              const payload = JSON.parse(schemaPayload) as Record<string, unknown>;
              const res = await generateSeoSchemaSnippet(schemaType, payload);
              setToolOutput(JSON.stringify(res.jsonLd, null, 2));
            } catch (e: unknown) {
              setError(e instanceof Error ? e.message : String(e));
            }
          }}
        >
          Build JSON-LD
        </button>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-5">
        <h2 className="text-lg font-medium text-white">Sitemap / robots check</h2>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-1 text-xs text-slate-400">
            Site origin
            <input
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none ring-sky-500/40 focus:ring-2"
              value={originCheck}
              onChange={(e) => setOriginCheck(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-medium text-slate-100 hover:bg-slate-700"
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                const res = await getSeoSitemapReport(originCheck.trim());
                setToolOutput(JSON.stringify(res, null, 2));
              } catch (e: unknown) {
                setError(e instanceof Error ? e.message : String(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            Check sitemap & robots
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-5">
        <h2 className="text-lg font-medium text-white">Comparison page helper</h2>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-1 text-xs text-slate-400">
            Topic
            <select
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none ring-sky-500/40 focus:ring-2"
              value={topicId}
              onChange={(e) => setTopicId(e.target.value as typeof topicId)}
            >
              <option value="rapid-cortex-vs-legacy-cad">Rapid Cortex vs legacy CAD</option>
              <option value="rapid-cortex-vs-ng911-media-only">Rapid Cortex vs NG911 media-only</option>
              <option value="rc-lite-api-cad-vendors">RC Lite API for CAD vendors</option>
              <option value="emergency-response-intelligence">Emergency response intelligence</option>
              <option value="911-dispatcher-decision-support">911 dispatcher decision-support</option>
            </select>
          </label>
          <button
            type="button"
            className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-medium text-slate-100 hover:bg-slate-700"
            onClick={async () => {
              setError(null);
              try {
                const res = await postSeoCompetitorOutline(topicId);
                setToolOutput(JSON.stringify(res, null, 2));
              } catch (e: unknown) {
                setError(e instanceof Error ? e.message : String(e));
              }
            }}
          >
            Generate outline
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-5">
        <h2 className="text-lg font-medium text-white">SEO issue tracker</h2>
        <IssuesPanel onRefresh={refresh} />
      </section>

      {toolOutput ? (
        <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-medium text-white">Last tool output</h2>
            <button
              type="button"
              className="text-xs text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline"
              onClick={() => setToolOutput(null)}
            >
              Clear
            </button>
          </div>
          <pre className="mt-3 max-h-[420px] overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-3 text-left font-mono text-[11px] leading-relaxed text-slate-200">
            {toolOutput}
          </pre>
        </section>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-3">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-white">{value}</div>
    </div>
  );
}

function formatIso(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function IssuesPanel({ onRefresh }: { onRefresh: () => Promise<void> }) {
  const [items, setItems] = useState<Awaited<ReturnType<typeof fetchSeoIssues>>>([]);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    const data = await fetchSeoIssues();
    setItems(data);
  }, []);

  useEffect(() => {
    void load().catch((e: unknown) => setErr(e instanceof Error ? e.message : String(e)));
  }, [load]);

  return (
    <div className="space-y-3">
      <button
        type="button"
        className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-medium text-slate-100 hover:bg-slate-700"
        onClick={() =>
          load()
            .then(() => onRefresh())
            .catch((e: unknown) => setErr(e instanceof Error ? e.message : String(e)))
        }
      >
        Reload issues
      </button>
      {err ? <div className="text-sm text-rose-300">{err}</div> : null}
      <ul className="divide-y divide-slate-800 rounded-lg border border-slate-800">
        {items.length === 0 ? (
          <li className="px-4 py-6 text-sm text-slate-500">No issues recorded.</li>
        ) : (
          items.map((i) => (
            <li key={i.id} className="flex flex-col gap-2 px-4 py-3 text-sm sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-slate-900 px-2 py-0.5 text-[11px] uppercase text-slate-400">
                    {i.severity}
                  </span>
                  <span className="text-[11px] text-slate-500">{i.issueType}</span>
                  <span className="text-[11px] text-slate-600">{i.status}</span>
                </div>
                <div className="text-slate-200">{i.description}</div>
                <div className="text-xs text-slate-500">{i.recommendation}</div>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  className="rounded-md border border-slate-700 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-900"
                  onClick={() =>
                    patchSeoIssueStatus(i.id, "FIXED")
                      .then(() => load())
                      .then(() => onRefresh())
                      .catch((e: unknown) => setErr(e instanceof Error ? e.message : String(e)))
                  }
                >
                  Fixed
                </button>
                <button
                  type="button"
                  className="rounded-md border border-slate-700 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-900"
                  onClick={() =>
                    patchSeoIssueStatus(i.id, "IGNORED")
                      .then(() => load())
                      .then(() => onRefresh())
                      .catch((e: unknown) => setErr(e instanceof Error ? e.message : String(e)))
                  }
                >
                  Ignore
                </button>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
