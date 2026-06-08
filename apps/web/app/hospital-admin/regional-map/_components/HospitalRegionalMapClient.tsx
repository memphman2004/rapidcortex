"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

/**
 * apps/web/app/hospital-admin/regional-map/_components/HospitalRegionalMapClient.tsx
 * Same component as dashboard regional widget but full-page with search/filter.
 */
export function HospitalRegionalMapClient({ agencyId }: { agencyId: string }) {
  const [filter, setFilter] = useState<"ALL" | "OPEN" | "ALERT" | "DIVERSION">("ALL");

  const { data: facilities = [], isLoading } = useQuery({
    queryKey: ["regional-capacity", agencyId],
    queryFn: async () => {
      const r = await fetch(`/api/hospital/${agencyId}/regional/capacity`, { credentials: "include" });
      return r.ok ? r.json().then((d: { facilities?: unknown[] }) => d.facilities ?? []) : [];
    },
    refetchInterval: 60_000,
  });

  type RegFacility = { facilityId: string; facilityName: string; diversionStatus: "OPEN" | "ALERT" | "DIVERSION"; bedsAvailable: number; bedsTotal: number; distanceMiles: number | null; lastUpdatedAt?: string };
  const facs = facilities as RegFacility[];

  const filtered = filter === "ALL" ? facs : facs.filter(f => f.diversionStatus === filter);
  const counts = { OPEN: facs.filter(f => f.diversionStatus === "OPEN").length, ALERT: facs.filter(f => f.diversionStatus === "ALERT").length, DIVERSION: facs.filter(f => f.diversionStatus === "DIVERSION").length };

  const STATUS_COLORS: Record<string, { bg: string; border: string; text: string; bar: string }> = {
    OPEN:      { bg: "bg-emerald-900/30", border: "border-emerald-700/50", text: "text-emerald-400", bar: "bg-emerald-500" },
    ALERT:     { bg: "bg-yellow-900/20",  border: "border-yellow-700/50",  text: "text-yellow-400",  bar: "bg-yellow-500" },
    DIVERSION: { bg: "bg-rose-900/20",    border: "border-rose-700/50",    text: "text-rose-400",    bar: "bg-rose-500"   },
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="px-6 py-8">
        <div className="mb-6">
          <p className="text-xs font-medium uppercase tracking-widest text-teal-600">Hospital Portal</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">Regional Capacity Map</h1>
          <p className="mt-1 text-sm text-slate-400">All facilities in your region, updated every 60 seconds.</p>
        </div>

        {/* Filter bar */}
        <div className="mb-6 flex flex-wrap gap-2">
          {(["ALL", "OPEN", "ALERT", "DIVERSION"] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === s
                  ? "bg-teal-800 text-teal-200"
                  : "border border-slate-700 bg-slate-900 text-slate-400 hover:bg-slate-800"
              }`}
            >
              {s === "ALL" ? `All (${facs.length})` : `${s} (${counts[s]})`}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-slate-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center py-24">
            <p className="text-sm text-slate-600">No facilities match the selected filter.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map(f => {
              const cfg = STATUS_COLORS[f.diversionStatus] ?? STATUS_COLORS.OPEN;
              const pct = f.bedsTotal > 0 ? Math.round((f.bedsAvailable / f.bedsTotal) * 100) : 0;
              return (
                <div key={f.facilityId} className={`rounded-xl border p-4 ${cfg.border} ${cfg.bg}`}>
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <p className="font-medium leading-tight text-white">{f.facilityName}</p>
                    <span className={`flex-shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${cfg.text}`}>
                      {f.diversionStatus}
                    </span>
                  </div>
                  <div className="mb-3">
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                      <div className={`h-full rounded-full ${cfg.bar}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className={`text-2xl font-bold tabular-nums ${cfg.text}`}>{f.bedsAvailable}</span>
                    <span className="text-sm text-slate-500">/{f.bedsTotal} beds</span>
                  </div>
                  {f.distanceMiles != null && (
                    <p className="mt-2 text-xs text-slate-600">{f.distanceMiles.toFixed(1)} mi away</p>
                  )}
                  {f.lastUpdatedAt && (
                    <p className="mt-1 text-[10px] text-slate-700">
                      Updated {new Date(f.lastUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
