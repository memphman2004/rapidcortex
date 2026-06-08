"use client";

import { useQuery } from "@tanstack/react-query";

export function HospitalAnalyticsClient({
  agencyId, canExport,
}: {
  agencyId: string;
  canExport: boolean;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["hospital-analytics", agencyId],
    queryFn: async () => {
      const r = await fetch(`/api/hospital/${agencyId}/analytics/summary`, { credentials: "include" });
      return r.ok ? r.json() : null;
    },
  });

  const stats = [
    { label: "Avg beds available (7d)", value: data?.avgBedsAvailable7d ?? "—", sub: "Rolling average" },
    { label: "Diversion hours (7d)",    value: data?.diversionHours7d != null ? `${data.diversionHours7d}h` : "—", sub: "Total diversion time" },
    { label: "EMS routed in (7d)",      value: data?.emsRoutedIn7d ?? "—", sub: "Transports received" },
    { label: "EMS routed out (7d)",     value: data?.emsRoutedOut7d ?? "—", sub: "Diverted to other facilities" },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="px-6 py-8">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-teal-600">Hospital Portal</p>
            <h1 className="mt-1 text-2xl font-semibold text-white">Analytics</h1>
            {!canExport && (
              <p className="mt-1 text-xs text-slate-500">
                View-only access — contact your facility administrator to export data.
              </p>
            )}
          </div>
          {canExport && (
            <button
              onClick={() => window.open(`/api/hospital/${agencyId}/analytics/export`, "_blank")}
              className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              Export CSV
            </button>
          )}
        </div>

        {/* Stat cards */}
        <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map(s => (
            <div key={s.label} className="rounded-xl border border-slate-700/60 bg-slate-900 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{s.label}</p>
              <p className="mt-2 text-3xl font-bold text-white tabular-nums">
                {isLoading ? <span className="animate-pulse text-slate-700">—</span> : String(s.value)}
              </p>
              <p className="mt-1 text-xs text-slate-600">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Diversion frequency — bar chart */}
        <section className="mb-6 rounded-xl border border-slate-700/60 bg-slate-900 p-5">
          <h2 className="mb-4 text-sm font-semibold text-white">Diversion Frequency — Last 30 Days</h2>
          {isLoading ? (
            <div className="h-32 animate-pulse rounded-lg bg-slate-800" />
          ) : (
            <div className="flex items-end gap-1 px-2 py-4" style={{ height: 120 }}>
              {(data?.diversionByDay30d ?? Array(30).fill({ date: "", hours: 0 })).map(
                (day: { date: string; hours: number }, i: number) => {
                  const maxH = Math.max(...(data?.diversionByDay30d ?? []).map((d: { hours: number }) => d.hours), 1);
                  const pct = (day.hours / maxH) * 100;
                  return (
                    <div
                      key={i}
                      className={`flex-1 rounded-t transition-all ${day.hours > 0 ? "bg-rose-800 hover:bg-rose-700" : "bg-slate-800"}`}
                      style={{ height: `${Math.max(pct, day.hours > 0 ? 8 : 2)}%` }}
                      title={day.date ? `${day.date}: ${day.hours}h diversion` : ""}
                    />
                  );
                }
              )}
            </div>
          )}
          <p className="mt-2 text-center text-xs text-slate-600">Each bar = 1 day · Height = diversion hours</p>
        </section>

        {/* EMS volume trend */}
        <section className="rounded-xl border border-slate-700/60 bg-slate-900 p-5">
          <h2 className="mb-4 text-sm font-semibold text-white">EMS Volume — Last 30 Days</h2>
          {isLoading ? (
            <div className="h-32 animate-pulse rounded-lg bg-slate-800" />
          ) : (
            <div className="flex items-end gap-1 px-2 py-4" style={{ height: 120 }}>
              {(data?.emsByDay30d ?? Array(30).fill({ date: "", in: 0, out: 0 })).map(
                (day: { date: string; in: number; out: number }, i: number) => {
                  const maxH = Math.max(...(data?.emsByDay30d ?? []).map((d: { in: number }) => d.in), 1);
                  const pct = (day.in / maxH) * 100;
                  return (
                    <div
                      key={i}
                      className="flex flex-1 flex-col justify-end gap-0.5"
                      style={{ height: "100%" }}
                    >
                      <div
                        className="w-full rounded-t bg-teal-800 hover:bg-teal-700 transition-all"
                        style={{ height: `${Math.max(pct, day.in > 0 ? 6 : 2)}%` }}
                        title={day.date ? `${day.date}: ${day.in} in / ${day.out} out` : ""}
                      />
                    </div>
                  );
                }
              )}
            </div>
          )}
          <div className="mt-2 flex items-center justify-center gap-4 text-xs text-slate-600">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-teal-800" />EMS routed in</span>
          </div>
        </section>
      </div>
    </div>
  );
}
