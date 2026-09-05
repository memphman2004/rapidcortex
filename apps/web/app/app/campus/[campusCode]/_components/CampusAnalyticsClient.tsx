"use client";

import { useCallback, useEffect, useState } from "react";
import { CAMPUS_SITE_SCOPE_ALL } from "rapid-cortex-shared";
import { useSession } from "@/components/auth/session-context";
import { useCampusSiteScope } from "@/lib/campus/use-campus-site-scope";

type DateRange = "today" | "week" | "month";

type CampusAnalytics = {
  totalIncidents: number;
  openIncidents: number;
  respondingNow: number;
  resolvedToday: number;
  confidentialReports: number;
  byType: Record<string, number>;
  byBuilding: { buildingLabel: string; count: number }[];
  bySource: { qr: number; sms: number; manual: number; phone: number };
  avgResponseMinutes: number;
  escalatedToCore: number;
  referredToCounseling: number;
};

function emptyAnalytics(): CampusAnalytics {
  return {
    totalIncidents: 0,
    openIncidents: 0,
    respondingNow: 0,
    resolvedToday: 0,
    confidentialReports: 0,
    byType: {},
    byBuilding: [],
    bySource: { qr: 0, sms: 0, manual: 0, phone: 0 },
    avgResponseMinutes: 0,
    escalatedToCore: 0,
    referredToCounseling: 0,
  };
}

export function CampusAnalyticsClient({ campusCode }: { campusCode: string }) {
  const { user } = useSession();
  const { scope } = useCampusSiteScope(user?.agencyId ?? "");
  const [range, setRange] = useState<DateRange>("today");
  const [data, setData] = useState<CampusAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({
        campusCode: campusCode.toUpperCase(),
        range,
      });
      if (scope && scope !== CAMPUS_SITE_SCOPE_ALL) {
        qs.set("site", scope);
      }
      const res = await fetch(`/api/campus/analytics?${qs}`, { cache: "no-store" });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        data?: CampusAnalytics;
      } & Partial<CampusAnalytics>;
      if (!res.ok) {
        throw new Error(json.error ?? `Failed to load analytics (${res.status})`);
      }
      // Upstream may wrap in { data } or return the payload directly.
      const payload = (json.data ?? json) as CampusAnalytics;
      setData({
        ...emptyAnalytics(),
        ...payload,
        bySource: { ...emptyAnalytics().bySource, ...(payload.bySource ?? {}) },
      });
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [campusCode, range, scope]);

  useEffect(() => {
    void load();
  }, [load]);

  const metrics = data ?? emptyAnalytics();
  const typeEntries = Object.entries(metrics.byType).sort((a, b) => b[1] - a[1]);
  const maxType = Math.max(...typeEntries.map(([, n]) => n), 1);
  const maxBuilding = Math.max(...metrics.byBuilding.map((b) => b.count), 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Campus analytics</h2>
          <p className="mt-1 text-sm text-slate-400">
            Incident volume, response, and source mix for every campus in this tenant.
            Use the campus filter in the header to focus one location.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["today", "week", "month"] as DateRange[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRange(value)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                range === value
                  ? "border-sky-400 bg-sky-500/20 text-sky-200"
                  : "border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
              }`}
            >
              {value === "today" ? "Today" : value === "week" ? "This week" : "This month"}
            </button>
          ))}
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-md border border-slate-600 px-3 py-1 text-xs text-slate-200 hover:bg-slate-800"
          >
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Total incidents", metrics.totalIncidents],
          ["Open", metrics.openIncidents],
          ["Responding now", metrics.respondingNow],
          ["Resolved today", metrics.resolvedToday],
          ["Avg response (min)", metrics.avgResponseMinutes],
          ["Confidential", metrics.confidentialReports],
          ["Escalated to Core", metrics.escalatedToCore],
          ["Referred to counseling", metrics.referredToCounseling],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            className="rounded-lg border border-slate-700/50 bg-slate-900/40 px-4 py-3"
          >
            <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-white">
              {loading && !data ? "—" : value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-5">
          <h3 className="text-sm font-semibold text-white">By source</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            <li className="flex justify-between"><span>QR</span><span>{metrics.bySource.qr}</span></li>
            <li className="flex justify-between"><span>SMS</span><span>{metrics.bySource.sms}</span></li>
            <li className="flex justify-between"><span>Manual</span><span>{metrics.bySource.manual}</span></li>
            <li className="flex justify-between"><span>Phone</span><span>{metrics.bySource.phone}</span></li>
          </ul>
        </section>

        <section className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-5">
          <h3 className="text-sm font-semibold text-white">By type</h3>
          <ul className="mt-3 space-y-2">
            {typeEntries.length === 0 ? (
              <li className="text-sm text-slate-500">No incidents in this range.</li>
            ) : (
              typeEntries.map(([type, count]) => (
                <li key={type}>
                  <div className="mb-1 flex justify-between text-xs text-slate-400">
                    <span className="capitalize">{type.replace(/_/g, " ")}</span>
                    <span>{count}</span>
                  </div>
                  <div className="h-1.5 rounded bg-slate-800">
                    <div
                      className="h-1.5 rounded bg-sky-500/70"
                      style={{ width: `${Math.round((count / maxType) * 100)}%` }}
                    />
                  </div>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>

      <section className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-5">
        <h3 className="text-sm font-semibold text-white">Top buildings</h3>
        <ul className="mt-3 space-y-2">
          {metrics.byBuilding.length === 0 ? (
            <li className="text-sm text-slate-500">No building activity in this range.</li>
          ) : (
            metrics.byBuilding.slice(0, 8).map((row) => (
              <li key={row.buildingLabel}>
                <div className="mb-1 flex justify-between text-xs text-slate-400">
                  <span>{row.buildingLabel || "Unspecified"}</span>
                  <span>{row.count}</span>
                </div>
                <div className="h-1.5 rounded bg-slate-800">
                  <div
                    className="h-1.5 rounded bg-emerald-500/70"
                    style={{ width: `${Math.round((row.count / maxBuilding) * 100)}%` }}
                  />
                </div>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
