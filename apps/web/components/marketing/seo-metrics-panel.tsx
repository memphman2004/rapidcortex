"use client";

import { useEffect, useState } from "react";
import type {
  MarketingSeoMetricsData,
  MarketingSeoPageRow,
  MarketingSeoQueryRow,
  MarketingSeoSourceStatus,
} from "rapid-cortex-shared";

function statusStyle(status: MarketingSeoSourceStatus | undefined): string {
  switch (status) {
    case "ok":
      return "text-emerald-300 bg-emerald-950/40 border-emerald-700/40";
    case "authorization_required":
    case "secret_missing":
    case "misconfigured":
      return "text-amber-300 bg-amber-950/40 border-amber-700/40";
    case "mock":
      return "text-slate-400 bg-slate-800/40 border-slate-700/40";
    default:
      return "text-rose-300 bg-rose-950/40 border-rose-700/40";
  }
}

function pct(n: number | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

function num(n: number | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString();
}

function pos(n: number | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toFixed(1);
}

export function SeoMetricsPanel() {
  const [data, setData] = useState<MarketingSeoMetricsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/rc-admin/marketing/seo-metrics?days=90", {
          credentials: "include",
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const json = (await res.json()) as { success?: boolean; data?: MarketingSeoMetricsData };
        if (!cancelled) {
          setData(json.data ?? null);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load SEO metrics");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-[#0a1628] p-5 text-sm text-slate-500">
        Syncing Search Console + GA4…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-rose-900/40 bg-rose-950/20 p-5 text-sm text-rose-200">
        SEO metrics unavailable: {error ?? "No data"}
      </div>
    );
  }

  const search = data.search;
  const analytics = data.analytics;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-slate-500">Last sync:</span>
        <span className="text-slate-300">{new Date(data.syncedAt).toLocaleString()}</span>
        <span className={`rounded-full border px-2 py-0.5 ${statusStyle(search?.status)}`}>
          GSC: {search?.status ?? "—"}
        </span>
        <span className={`rounded-full border px-2 py-0.5 ${statusStyle(analytics?.status)}`}>
          GA4: {analytics?.status ?? "—"}
        </span>
        <span className="text-slate-500">
          {data.measurementId}
          {data.ga4PropertyId ? ` · property ${data.ga4PropertyId}` : ""}
        </span>
      </div>

      {(search?.status === "authorization_required" ||
        analytics?.status === "authorization_required" ||
        (data.authorization?.requiredGrants?.length ?? 0) > 0) && (
        <div className="rounded-xl border border-amber-800/40 bg-amber-950/20 p-4 text-sm text-amber-100/90">
          <p className="font-medium text-amber-200">Manual Google authorization required</p>
          <p className="mt-1 text-xs text-amber-100/70">
            Service account: {data.authorization?.serviceAccountEmail ?? "nexcortiq-gsc-ga4@rapidcortex-prod.iam.gserviceaccount.com"}
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-100/80">
            {(data.authorization?.requiredGrants ?? []).map((g: string) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
          {search?.error && <p className="mt-2 text-xs text-amber-200/60">GSC: {search.error}</p>}
          {analytics?.error && (
            <p className="mt-1 text-xs text-amber-200/60">GA4: {analytics.error}</p>
          )}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Impressions (90d)", value: num(search?.totals?.impressions) },
          { label: "Search clicks", value: num(search?.totals?.clicks) },
          { label: "Avg position", value: pos(search?.totals?.position) },
          { label: "CTR", value: pct(search?.totals?.ctr) },
          { label: "Sessions", value: num(analytics?.sessions) },
          { label: "Users", value: num(analytics?.users) },
          { label: "Demo requests (CRM)", value: num(data.crm?.demoRequests) },
          {
            label: "Qualified leads (CRM)",
            value: `${num(data.crm?.qualifiedLeads)}${
              data.crm?.conversionRate != null ? ` · ${pct(data.crm.conversionRate)}` : ""
            }`,
          },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-white/[0.06] bg-[#0a1628] px-4 py-3"
          >
            <div className="text-[11px] uppercase tracking-wide text-slate-500">{card.label}</div>
            <div className="mt-1 text-lg font-semibold text-white">{card.value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-white/[0.06] bg-[#0a1628] p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-200">Top search queries</h3>
          {(search?.topQueries?.length ?? 0) === 0 ? (
            <p className="text-xs text-slate-500">No query rows yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-slate-500">
                  <tr>
                    <th className="pb-2 font-medium">Query</th>
                    <th className="pb-2 font-medium">Imp</th>
                    <th className="pb-2 font-medium">Clicks</th>
                    <th className="pb-2 font-medium">Pos</th>
                  </tr>
                </thead>
                <tbody>
                  {search!.topQueries.slice(0, 12).map((row: MarketingSeoQueryRow) => (
                    <tr key={row.query} className="border-t border-white/[0.04] text-slate-300">
                      <td className="py-1.5 pr-2">{row.query}</td>
                      <td className="py-1.5">{num(row.impressions)}</td>
                      <td className="py-1.5">{num(row.clicks)}</td>
                      <td className="py-1.5">{pos(row.position)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-[#0a1628] p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-200">Monitored category queries</h3>
          {(search?.monitoredQueries?.length ?? 0) === 0 ? (
            <p className="text-xs text-slate-500">No impressions on monitored head terms yet.</p>
          ) : (
            <ul className="space-y-2 text-xs text-slate-300">
              {search!.monitoredQueries.map((row: MarketingSeoQueryRow) => (
                <li key={row.query} className="flex justify-between gap-3 border-b border-white/[0.04] pb-2">
                  <span>{row.query}</span>
                  <span className="shrink-0 text-slate-500">
                    {num(row.impressions)} imp · {num(row.clicks)} clk · {pos(row.position)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-[#0a1628] p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-200">Landing page traffic</h3>
          {(analytics?.landingPages?.length ?? 0) === 0 ? (
            <p className="text-xs text-slate-500">No GA4 landing pages returned.</p>
          ) : (
            <ul className="space-y-2 text-xs text-slate-300">
              {analytics!.landingPages.slice(0, 10).map((row: { pagePath: string; sessions: number; users: number }) => (
                <li key={row.pagePath} className="flex justify-between gap-3 border-b border-white/[0.04] pb-2">
                  <span className="truncate">{row.pagePath}</span>
                  <span className="shrink-0 text-slate-500">{num(row.sessions)} sessions</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-[#0a1628] p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-200">AI referrals + lead events</h3>
          <div className="space-y-3 text-xs">
            {(analytics?.aiReferrals?.length ?? 0) === 0 ? (
              <p className="text-slate-500">No AI referral sources detected in sessionSource.</p>
            ) : (
              <ul className="space-y-1 text-slate-300">
                {analytics!.aiReferrals.map((r: { source: string; sessions: number }) => (
                  <li key={r.source} className="flex justify-between gap-3">
                    <span>{r.source}</span>
                    <span className="text-slate-500">{num(r.sessions)}</span>
                  </li>
                ))}
              </ul>
            )}
            {(analytics?.leadEvents?.length ?? 0) === 0 ? (
              <p className="text-slate-500">
                No generate_lead / demo_request / calculator events in range.
              </p>
            ) : (
              <ul className="space-y-1 text-slate-300">
                {analytics!.leadEvents.map((e: { eventName: string; eventCount: number }) => (
                  <li key={e.eventName} className="flex justify-between gap-3">
                    <span>{e.eventName}</span>
                    <span className="text-slate-500">{num(e.eventCount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {(search?.lowCtrPages?.length ?? 0) > 0 && (
        <div className="rounded-xl border border-white/[0.06] bg-[#0a1628] p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-200">
            Pages with impressions but low CTR (&lt;2%, ≥20 imp)
          </h3>
          <ul className="space-y-2 text-xs text-slate-300">
            {search!.lowCtrPages.map((p: MarketingSeoPageRow) => (
              <li key={p.page} className="flex justify-between gap-3 border-b border-white/[0.04] pb-2">
                <span className="truncate">{p.page}</span>
                <span className="shrink-0 text-slate-500">
                  {num(p.impressions)} imp · {pct(p.ctr)} CTR · pos {pos(p.position)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
