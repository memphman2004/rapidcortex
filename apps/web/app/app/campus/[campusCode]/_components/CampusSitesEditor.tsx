"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, MapPin, Plus, Save, Trash2 } from "lucide-react";
import type { CampusSite } from "rapid-cortex-shared";
import {
  fetchCampusBuildings,
  fetchCampusSites,
  saveCampusSites,
} from "@/lib/campus/campus-dashboard-api";

function emptySite(): CampusSite {
  return { code: "", name: "", city: "", state: "", kind: "other", active: true };
}

export function CampusSitesEditor({ agencyId }: { agencyId: string }) {
  const qc = useQueryClient();
  const sitesQuery = useQuery({
    queryKey: ["campus-sites", agencyId],
    queryFn: () => fetchCampusSites(agencyId),
  });
  const buildingsQuery = useQuery({
    queryKey: ["campus-buildings", agencyId],
    queryFn: () => fetchCampusBuildings(agencyId),
  });

  const [sites, setSites] = useState<CampusSite[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sitesQuery.data) return;
    setSites(sitesQuery.data.sites);
  }, [sitesQuery.data]);

  useEffect(() => {
    if (!buildingsQuery.data) return;
    const next: Record<string, string> = {};
    for (const building of buildingsQuery.data) {
      if (building.siteCode) next[building.buildingId] = building.siteCode;
    }
    setAssignments(next);
  }, [buildingsQuery.data]);

  const saveMut = useMutation({
    mutationFn: () =>
      saveCampusSites(agencyId, {
        sites: sites.filter((site) => site.code.trim() && site.name.trim()),
        buildingAssignments: Object.entries(assignments)
          .filter(([, siteCode]) => siteCode.trim())
          .map(([buildingId, siteCode]) => ({ buildingId, siteCode })),
      }),
    onSuccess: async () => {
      setError(null);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["campus-sites", agencyId] }),
        qc.invalidateQueries({ queryKey: ["campus-buildings", agencyId] }),
      ]);
    },
    onError: (err: Error) => setError(err.message),
  });

  if (sitesQuery.isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-slate-700/60 bg-slate-900 p-6">
      <div className="mb-6 flex items-start gap-3">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-slate-800">
          <MapPin className="h-4 w-4 text-slate-400" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-white">Campuses & locations</h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Every campus this tenant operates. Dashboards, buildings, QR locations, and cameras can
            switch across this list. Assign buildings so operators see the right map.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {sites.map((site, index) => (
          <div key={`${site.code}-${index}`} className="grid gap-2 sm:grid-cols-5">
            <input
              value={site.code}
              onChange={(e) =>
                setSites((rows) =>
                  rows.map((row, i) =>
                    i === index ? { ...row, code: e.target.value.toUpperCase() } : row,
                  ),
                )
              }
              placeholder="Code"
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
            />
            <input
              value={site.name}
              onChange={(e) =>
                setSites((rows) =>
                  rows.map((row, i) => (i === index ? { ...row, name: e.target.value } : row)),
                )
              }
              placeholder="Name"
              className="sm:col-span-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
            />
            <input
              value={site.city ?? ""}
              onChange={(e) =>
                setSites((rows) =>
                  rows.map((row, i) => (i === index ? { ...row, city: e.target.value } : row)),
                )
              }
              placeholder="City"
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
            />
            <div className="flex gap-2">
              <input
                value={site.state ?? ""}
                onChange={(e) =>
                  setSites((rows) =>
                    rows.map((row, i) =>
                      i === index ? { ...row, state: e.target.value.toUpperCase() } : row,
                    ),
                  )
                }
                placeholder="ST"
                maxLength={2}
                className="w-16 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
              />
              <button
                type="button"
                onClick={() => setSites((rows) => rows.filter((_, i) => i !== index))}
                className="rounded-lg border border-slate-700 px-2 text-slate-400 hover:text-rose-300"
                aria-label="Remove campus"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setSites((rows) => [...rows, emptySite()])}
          className="inline-flex items-center gap-1 text-xs font-medium text-sky-300 hover:text-sky-200"
        >
          <Plus className="h-3.5 w-3.5" />
          Add campus
        </button>
      </div>

      {(buildingsQuery.data ?? []).length > 0 ? (
        <div className="mt-6">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Assign buildings
          </h3>
          <ul className="mt-3 divide-y divide-slate-800 rounded-lg border border-slate-800">
            {(buildingsQuery.data ?? []).map((building) => (
              <li key={building.buildingId} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="text-sm text-slate-200">{building.buildingName}</span>
                <select
                  value={assignments[building.buildingId] ?? ""}
                  onChange={(e) =>
                    setAssignments((current) => ({
                      ...current,
                      [building.buildingId]: e.target.value,
                    }))
                  }
                  className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-white"
                >
                  <option value="">Unassigned</option>
                  {sites
                    .filter((site) => site.code.trim())
                    .map((site) => (
                      <option key={site.code} value={site.code}>
                        {site.name || site.code}
                      </option>
                    ))}
                </select>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? <p className="mt-4 text-sm text-rose-400">{error}</p> : null}

      <button
        type="button"
        onClick={() => saveMut.mutate()}
        disabled={saveMut.isPending}
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600 disabled:opacity-50"
      >
        {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Save campuses
      </button>
    </section>
  );
}
