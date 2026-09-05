"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { matchesCampusSiteScope, type CampusBuildingSummary } from "rapid-cortex-shared";
import { fetchCampusBuildings } from "@/lib/campus/campus-dashboard-api";
import { CampusSiteSwitcher } from "@/components/campus/campus-site-switcher";
import { useCampusSiteScope } from "@/lib/campus/use-campus-site-scope";

export function CampusBuildingsClient({
  campusCode,
  agencyId,
}: {
  campusCode: string;
  agencyId: string;
}) {
  const [buildings, setBuildings] = useState<CampusBuildingSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { scope, setScope, sites, primarySiteCode } = useCampusSiteScope(agencyId);

  const visible = useMemo(
    () =>
      buildings.filter((building) =>
        matchesCampusSiteScope(building.siteCode, scope, primarySiteCode || campusCode),
      ),
    [buildings, campusCode, primarySiteCode, scope],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setBuildings(await fetchCampusBuildings(agencyId));
    } catch (err) {
      setBuildings([]);
      setError(err instanceof Error ? err.message : "Failed to load buildings");
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
          <h2 className="text-lg font-semibold text-white">Buildings</h2>
          <p className="mt-1 text-sm text-slate-400">
            Buildings and zones across every campus in this tenant. Use the campus filter to focus
            one location.
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

      {error ? (
        <div className="rounded-md border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      ) : null}

      {loading && visible.length === 0 ? (
        <p className="text-sm text-slate-500">Loading buildings…</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-slate-500">No buildings configured yet.</p>
      ) : (
        <ul className="divide-y divide-slate-800 rounded-lg border border-slate-700/50 bg-slate-900/40">
          {visible.map((b) => (
            <li key={b.buildingId} className="flex items-center justify-between gap-4 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-white">{b.buildingName}</p>
                <p className="text-xs text-slate-500">
                  {b.zone || "Unzoned"}
                  {b.siteCode ? ` · ${b.siteCode}` : ""}
                </p>
              </div>
              <div className="text-right text-xs text-slate-400">
                <p className="capitalize">{b.status}</p>
                <p>{b.activeIncidents} active</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
