"use client";

import { useMemo, useState } from "react";
import { FIXTURE_INCIDENTS } from "../_lib/venue-fixtures";
import type { IncidentType } from "../_lib/venue-types";

type DateRange = "today" | "week" | "month";

function percent(part: number, total: number): string {
  if (total === 0) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

export default function VenueAnalyticsPage() {
  const [dateRange, setDateRange] = useState<DateRange>("today");

  const metrics = useMemo(() => {
    const totalIncidents = FIXTURE_INCIDENTS.length;
    const qrReports = FIXTURE_INCIDENTS.filter((incident) => incident.source === "qr").length;
    const smsReports = FIXTURE_INCIDENTS.filter((incident) => incident.source === "sms").length;
    const escalated = FIXTURE_INCIDENTS.filter((incident) => incident.status === "escalated").length;
    const resolvedSameDay = FIXTURE_INCIDENTS.filter((incident) => incident.status === "resolved").length;
    const avgResponseTime = "6m 40s";

    const countsByType = FIXTURE_INCIDENTS.reduce<Record<IncidentType, number>>(
      (acc, incident) => {
        acc[incident.type] += 1;
        return acc;
      },
      {
        medical: 0,
        security: 0,
        lost_person: 0,
        maintenance: 0,
        guest_services: 0,
        other: 0,
      },
    );

    const countsByZone = FIXTURE_INCIDENTS.reduce<Record<string, number>>((acc, incident) => {
      acc[incident.zoneCode] = (acc[incident.zoneCode] ?? 0) + 1;
      return acc;
    }, {});

    const topZones = Object.entries(countsByZone)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return {
      totalIncidents,
      qrReports,
      smsReports,
      escalated,
      resolvedSameDay,
      avgResponseTime,
      countsByType,
      topZones,
    };
  }, []);

  const maxTypeCount = Math.max(...Object.values(metrics.countsByType), 1);
  const maxZoneCount = Math.max(...metrics.topZones.map(([, count]) => count), 1);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-white">Analytics</h1>
        <div className="flex flex-wrap gap-2">
          {(["today", "week", "month"] as DateRange[]).map((range) => (
            <button
              key={range}
              type="button"
              onClick={() => setDateRange(range)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                dateRange === range
                  ? "border-sky-400 bg-sky-500/20 text-sky-200"
                  : "border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
              }`}
            >
              {range === "today" ? "Today" : range === "week" ? "This Week" : "This Month"}
            </button>
          ))}
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-4">
          <p className="text-2xl font-bold text-white">{metrics.totalIncidents}</p>
          <p className="text-xs text-slate-400">Total Incidents</p>
        </div>
        <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-4">
          <p className="text-2xl font-bold text-white">{metrics.avgResponseTime}</p>
          <p className="text-xs text-slate-400">Avg Response Time</p>
        </div>
        <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-4">
          <p className="text-2xl font-bold text-white">{metrics.qrReports}</p>
          <p className="text-xs text-slate-400">QR Reports</p>
        </div>
        <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-4">
          <p className="text-2xl font-bold text-white">{metrics.smsReports}</p>
          <p className="text-xs text-slate-400">SMS Reports</p>
        </div>
        <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-4">
          <p className="text-2xl font-bold text-white">{metrics.escalated}</p>
          <p className="text-xs text-slate-400">Escalated to Core</p>
        </div>
        <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-4">
          <p className="text-2xl font-bold text-white">{metrics.resolvedSameDay}</p>
          <p className="text-xs text-slate-400">Resolved Same Day</p>
        </div>
      </section>

      <section className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-4">
        <h2 className="text-lg font-semibold text-white">Incidents by Type</h2>
        <div className="mt-3 space-y-3">
          {Object.entries(metrics.countsByType).map(([type, count]) => (
            <div key={type} className="grid grid-cols-[140px_1fr_36px] items-center gap-3 text-sm">
              <p className="text-slate-300">{type.replace("_", " ")}</p>
              <div className="h-3 rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-sky-500"
                  style={{ width: `${Math.max(8, (count / maxTypeCount) * 100)}%` }}
                />
              </div>
              <p className="text-right text-slate-200">{count}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-4">
        <h2 className="text-lg font-semibold text-white">Incidents by Zone (Top 5)</h2>
        <div className="mt-3 space-y-3">
          {metrics.topZones.map(([zoneCode, count]) => (
            <div key={zoneCode} className="grid grid-cols-[140px_1fr_36px] items-center gap-3 text-sm">
              <p className="text-slate-300">{zoneCode}</p>
              <div className="h-3 rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-sky-500"
                  style={{ width: `${Math.max(8, (count / maxZoneCount) * 100)}%` }}
                />
              </div>
              <p className="text-right text-slate-200">{count}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">QR Code</p>
          <p className="mt-1 text-2xl font-bold text-white">{metrics.qrReports}</p>
          <p className="text-sm text-slate-400">{percent(metrics.qrReports, metrics.totalIncidents)} of reports</p>
        </div>
        <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">SMS</p>
          <p className="mt-1 text-2xl font-bold text-white">{metrics.smsReports}</p>
          <p className="text-sm text-slate-400">{percent(metrics.smsReports, metrics.totalIncidents)} of reports</p>
        </div>
      </section>

      <p className="text-xs text-slate-500">
        Analytics update in real time during live events. Historical data is retained per your agency retention
        policy.
      </p>
    </div>
  );
}
