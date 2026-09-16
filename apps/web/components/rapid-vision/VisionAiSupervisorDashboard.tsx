"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { VisionSceneAlert } from "rapid-cortex-shared";
import { CameraAiAlertsPanel } from "./CameraAiAlertsPanel";
import { isRapidVisionSceneIntelEnabled } from "@/lib/runtime-flags";

type Stats = {
  totalAlerts: number;
  activeCount: number;
  dismissedCount: number;
  incidentCreatedCount: number;
  conversionRate: number;
  bySeverity: { critical: number; high: number; medium: number; low: number };
  byCamera: Array<{ cameraId: string; cameraName: string; count: number; dismissed: number; incidents: number }>;
  alerts: VisionSceneAlert[];
};

export function VisionAiSupervisorDashboard() {
  const enabled = isRapidVisionSceneIntelEnabled();
  const [severity, setSeverity] = useState<string>("all");

  const statsQuery = useQuery({
    queryKey: ["vision-scene-stats"],
    queryFn: async () => {
      const res = await fetch("/api/vision/scene-stats", { credentials: "include" });
      if (!res.ok) return null;
      const body = (await res.json()) as { data?: Stats };
      return body.data ?? null;
    },
    enabled,
    refetchInterval: 20_000,
  });

  const stats = statsQuery.data;
  const cameras = stats?.byCamera ?? [];
  const filtered = useMemo(() => {
    const rows = stats?.alerts ?? [];
    if (severity === "all") return rows;
    return rows.filter((a) => a.severity === severity);
  }, [stats?.alerts, severity]);

  if (!enabled) {
    return <p className="text-sm text-slate-400">Scene Intelligence is not enabled.</p>;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="space-y-4">
        <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["Active", stats?.activeCount ?? 0],
            ["24h alerts", stats?.totalAlerts ?? 0],
            ["Incidents", stats?.incidentCreatedCount ?? 0],
            ["Conversion", `${Math.round((stats?.conversionRate ?? 0) * 100)}%`],
          ].map(([label, value]) => (
            <article key={String(label)} className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
              <p className="mt-1 text-lg font-semibold text-white">{value}</p>
            </article>
          ))}
        </section>

        <section className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
          <h2 className="text-sm font-semibold text-white">Camera overlay</h2>
          <p className="mt-1 text-xs text-slate-500">Cameras with recent alerts highlight in red.</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {cameras.length === 0 ? (
              <li className="text-sm text-slate-500">No camera volume in this window.</li>
            ) : (
              cameras.map((cam) => (
                <li
                  key={cam.cameraId}
                  className="rounded border px-3 py-2 text-sm"
                  style={{
                    borderColor: cam.count > 0 ? "#7f1d1d" : "#1e293b",
                    background: cam.count > 0 ? "#450a0a66" : "#0f172a",
                  }}
                >
                  <p className="font-medium text-white">{cam.cameraName}</p>
                  <p className="text-xs text-slate-400">
                    {cam.count} alerts · {cam.incidents} incidents · {cam.dismissed} dismissed
                  </p>
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Alert history</h2>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
              className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200"
            >
              <option value="all">All severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="text-slate-500">
                <tr>
                  <th className="pb-2 font-medium">Time</th>
                  <th className="pb-2 font-medium">Camera</th>
                  <th className="pb-2 font-medium">Event</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((alert) => (
                  <tr key={alert.eventId} className="border-t border-slate-800">
                    <td className="py-2 font-mono">{new Date(alert.timestamp).toLocaleTimeString()}</td>
                    <td className="py-2">{alert.cameraName}</td>
                    <td className="py-2">{alert.shortLabel}</td>
                    <td className="py-2 uppercase">{alert.status.replace("_", " ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      <div className="min-h-[420px] overflow-hidden rounded-lg border border-slate-800">
        <CameraAiAlertsPanel />
      </div>
    </div>
  );
}
