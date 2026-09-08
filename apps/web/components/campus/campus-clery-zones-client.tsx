"use client";

import { useEffect, useState } from "react";
import {
  CLERY_ACT_GEOGRAPHIES,
  CLERY_ACT_GEOGRAPHY_LABELS,
  type CleryActGeography,
  type CleryZoneConfig,
} from "rapid-cortex-shared";

type ZoneRow = {
  rcli: string;
  locationName: string;
  building?: string;
  zoneCode: string;
  config: CleryZoneConfig | null;
};

export function CampusCleryZonesClient({ campusCode }: { campusCode: string }) {
  const code = campusCode.toUpperCase();
  const [rows, setRows] = useState<ZoneRow[]>([]);
  const [missing, setMissing] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { geo: CleryActGeography; residential: boolean; buildingName: string }>>(
    {},
  );

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/campus/clery/zones?campusCode=${encodeURIComponent(code)}`, { cache: "no-store" });
      const data = (await res.json()) as { zones?: ZoneRow[]; missing?: number; error?: string };
      if (!res.ok) {
        setError(data.error || "Failed to load");
        return;
      }
      setRows(data.zones ?? []);
      setMissing(data.missing ?? 0);
      const next: typeof drafts = {};
      for (const z of data.zones ?? []) {
        next[z.rcli] = {
          geo: z.config?.cleryGeography ?? "ON_CAMPUS",
          residential: z.config?.isResidentialFacility ?? false,
          buildingName: z.config?.buildingName ?? z.building ?? z.locationName,
        };
      }
      setDrafts(next);
    })();
  }, [code]);

  async function save(rcli: string) {
    const d = drafts[rcli];
    if (!d) return;
    const res = await fetch(`/api/campus/clery/zones/${encodeURIComponent(rcli)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        campusCode: code,
        cleryGeography: d.residential && d.geo === "ON_CAMPUS" ? "ON_CAMPUS_RESIDENTIAL" : d.geo,
        isResidentialFacility: d.residential,
        buildingName: d.buildingName,
      }),
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error || "Save failed");
    }
  }

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold text-white">Clery geography configuration</h1>
      <p className="text-sm text-slate-300">
        Map every zone to a Clery geographic category. Required before records can be finalized. {missing} of{" "}
        {rows.length} not yet configured.
      </p>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <table className="w-full text-left text-sm text-slate-200">
        <thead className="text-xs uppercase text-slate-400">
          <tr>
            <th className="py-2">Building</th>
            <th>Zone</th>
            <th>Geography</th>
            <th>Residential</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((z) => (
            <tr key={z.rcli} className="border-t border-slate-800">
              <td className="py-2">{z.building ?? z.locationName}</td>
              <td>{z.zoneCode}</td>
              <td>
                <select
                  className="rounded border border-slate-600 bg-slate-950 px-2 py-1"
                  value={drafts[z.rcli]?.geo ?? "ON_CAMPUS"}
                  onChange={(e) =>
                    setDrafts((prev) => ({
                      ...prev,
                      [z.rcli]: { ...prev[z.rcli], geo: e.target.value as CleryActGeography },
                    }))
                  }
                >
                  {CLERY_ACT_GEOGRAPHIES.map((g) => (
                    <option key={g} value={g}>
                      {CLERY_ACT_GEOGRAPHY_LABELS[g]}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <input
                  type="checkbox"
                  checked={drafts[z.rcli]?.residential ?? false}
                  onChange={(e) =>
                    setDrafts((prev) => ({
                      ...prev,
                      [z.rcli]: { ...prev[z.rcli], residential: e.target.checked },
                    }))
                  }
                />
              </td>
              <td>
                <button type="button" className="text-sky-400" onClick={() => void save(z.rcli)}>
                  Save
                </button>
                {z.config ? "" : " ⚠"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
