"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { matchesCampusSiteScope, type CampusZoneSummary } from "rapid-cortex-shared";
import { fetchCampusZones } from "@/lib/campus/campus-dashboard-api";
import { CampusSiteSwitcher } from "@/components/campus/campus-site-switcher";
import { useCampusSiteScope } from "@/lib/campus/use-campus-site-scope";

export function CampusZonesClient({
  campusCode,
  agencyId,
}: {
  campusCode: string;
  agencyId: string;
}) {
  const [zones, setZones] = useState<CampusZoneSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { scope, setScope, sites, primarySiteCode } = useCampusSiteScope(agencyId);

  const visible = useMemo(
    () =>
      zones.filter((zone) =>
        matchesCampusSiteScope(zone.siteCode, scope, primarySiteCode || campusCode),
      ),
    [zones, campusCode, primarySiteCode, scope],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setZones(await fetchCampusZones(agencyId));
    } catch (err) {
      setZones([]);
      setError(err instanceof Error ? err.message : "Failed to load zones");
    } finally {
      setLoading(false);
    }
  }, [agencyId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Zones</h2>
          <p className="mt-1 text-sm text-slate-400">
            Live campus zones for {campusCode} — incident and responder counts from the campus
            safety feed.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <CampusSiteSwitcher sites={sites} value={scope} onChange={setScope} />
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-md border border-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
          >
            Refresh
          </button>
        </div>
      </div>
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      {loading ? <p className="text-sm text-slate-400">Loading zones…</p> : null}
      {!loading && visible.length === 0 ? (
        <p className="text-sm text-slate-400">No zones are published for this campus yet.</p>
      ) : null}
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((zone) => (
          <li
            key={zone.zoneId}
            className="rounded-lg border border-slate-700/60 bg-slate-950/50 p-4"
          >
            <p className="text-sm font-semibold text-white">{zone.zoneName}</p>
            <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">{zone.status}</p>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-300">
              <div>
                <dt className="text-slate-500">Incidents</dt>
                <dd className="font-mono text-slate-100">{zone.incidentCount}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Responders</dt>
                <dd className="font-mono text-slate-100">{zone.responderCount}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </section>
  );
}
