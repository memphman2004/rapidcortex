"use client";

/**
 * apps/web/app/hospital-admin/dashboard/_components/HospitalDashboardClient.tsx
 *
 * Home dashboard for both HOSPITAL_ADMIN and HOSPITAL_COORDINATOR.
 * Layout from HOSPITAL_COORDINATOR_LAYOUT (widget-layout-config.ts):
 *   Row 1: Capacity status card (6) + Routing events (6)
 *   Row 2: Regional capacity map (12) — full width
 *   Row 3: Capacity trend chart (12)
 *
 * Admin sees identical layout. Additional admin-only widgets (user activity,
 * reports) live on their respective sub-pages, not the home dashboard.
 */

import { useQuery } from "@tanstack/react-query";
import {
  Activity, AlertTriangle, Bed, CheckCircle2, Clock,
  Loader2, Map, Route, TrendingDown, TrendingUp,
} from "lucide-react";
import { isHospitalCoordinatorRole, hospitalRoleDescription } from "@/lib/hospital/hospital-access";

// ─── Types ────────────────────────────────────────────────────────────────────

type DiversionStatus = "OPEN" | "ALERT" | "DIVERSION";

type FacilityCapacity = {
  facilityId: string;
  facilityName: string;
  diversionStatus: DiversionStatus;
  bedsAvailable: number;
  bedsTotal: number;
  traumaCapacity: "OPEN" | "LIMITED" | "CLOSED";
  lastUpdatedAt: string;
  updatedByName: string | null;
};

type RoutingEvent = {
  eventId: string;
  type: "EMS_ROUTED_IN" | "EMS_ROUTED_OUT" | "DIVERSION_STARTED" | "DIVERSION_ENDED" | "ALERT_TRIGGERED";
  description: string;
  occurredAt: string;
  unitId: string | null;
};

type CapacityTrendPoint = {
  timestamp: string;
  bedsAvailable: number;
  diversionStatus: DiversionStatus;
};

type RegionalFacility = {
  facilityId: string;
  facilityName: string;
  diversionStatus: DiversionStatus;
  bedsAvailable: number;
  bedsTotal: number;
  distanceMiles: number | null;
};

// ─── API fetchers ─────────────────────────────────────────────────────────────

async function fetchCapacity(agencyId: string): Promise<FacilityCapacity> {
  const r = await fetch(`/api/hospital/${agencyId}/capacity/current`, { credentials: "include" });
  if (!r.ok) throw new Error("Failed to load capacity");
  return r.json();
}

async function fetchRoutingEvents(agencyId: string): Promise<RoutingEvent[]> {
  const r = await fetch(`/api/hospital/${agencyId}/routing-events?limit=15`, { credentials: "include" });
  if (!r.ok) throw new Error("Failed to load routing events");
  const d = await r.json();
  return d.events ?? [];
}

async function fetchCapacityTrend(agencyId: string): Promise<CapacityTrendPoint[]> {
  const r = await fetch(`/api/hospital/${agencyId}/capacity/trend?days=7`, { credentials: "include" });
  if (!r.ok) throw new Error("Failed to load trend");
  const d = await r.json();
  return d.points ?? [];
}

async function fetchRegionalCapacity(agencyId: string): Promise<RegionalFacility[]> {
  const r = await fetch(`/api/hospital/${agencyId}/regional/capacity`, { credentials: "include" });
  if (!r.ok) throw new Error("Failed to load regional capacity");
  const d = await r.json();
  return d.facilities ?? [];
}

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  OPEN:      { bg: "bg-emerald-900/30", border: "border-emerald-700/50", text: "text-emerald-400", dot: "bg-emerald-400" },
  ALERT:     { bg: "bg-yellow-900/20",  border: "border-yellow-700/50",  text: "text-yellow-400",  dot: "bg-yellow-400" },
  DIVERSION: { bg: "bg-rose-900/20",    border: "border-rose-700/50",    text: "text-rose-400",    dot: "bg-rose-500"   },
} satisfies Record<DiversionStatus, object>;

function StatusBadge({ status, size = "sm" }: { status: DiversionStatus; size?: "sm" | "lg" }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium ${cfg.bg} ${cfg.border} ${cfg.text} ${size === "lg" ? "text-sm" : "text-xs"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {status}
    </span>
  );
}

// ─── Widget: Capacity status card ─────────────────────────────────────────────

function CapacityStatusCard({ agencyId }: { agencyId: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["facility-capacity", agencyId],
    queryFn: () => fetchCapacity(agencyId),
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex h-full animate-pulse items-center justify-center rounded-xl border border-slate-800 bg-slate-900/50">
        <Loader2 className="h-5 w-5 animate-spin text-slate-600" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-rose-900/30 bg-slate-900">
        <p className="text-xs text-rose-500">Failed to load capacity</p>
      </div>
    );
  }

  const cfg = STATUS_CONFIG[data.diversionStatus];
  const pct = data.bedsTotal > 0 ? Math.round((data.bedsAvailable / data.bedsTotal) * 100) : 0;

  return (
    <div className={`flex h-full flex-col rounded-xl border ${cfg.border} ${cfg.bg}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800/60 px-5 py-3">
        <div className="flex items-center gap-2">
          <Bed className="h-4 w-4 text-slate-500" />
          <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Facility Status
          </span>
        </div>
        <StatusBadge status={data.diversionStatus} />
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
        <p className={`text-6xl font-bold tabular-nums ${cfg.text}`}>
          {data.bedsAvailable}
        </p>
        <p className="mt-2 text-sm text-slate-400">
          beds available of {data.bedsTotal} total
        </p>

        {/* Capacity bar */}
        <div className="mt-5 w-full max-w-xs">
          <div className="mb-1 flex justify-between text-xs text-slate-500">
            <span>Capacity</span>
            <span>{pct}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-800">
            <div
              className={`h-full rounded-full transition-all ${
                pct > 50 ? "bg-emerald-500" : pct > 25 ? "bg-yellow-500" : "bg-rose-500"
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Trauma */}
        <div className="mt-5 flex items-center gap-2">
          <span className="text-xs text-slate-500">Trauma:</span>
          <span className={`text-xs font-medium ${
            data.traumaCapacity === "OPEN" ? "text-emerald-400" :
            data.traumaCapacity === "LIMITED" ? "text-yellow-400" : "text-rose-400"
          }`}>
            {data.traumaCapacity}
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-slate-800/60 px-5 py-3 text-center">
        <p className="text-xs text-slate-500">
          Updated {new Date(data.lastUpdatedAt).toLocaleTimeString()} by {data.updatedByName ?? "staff"}
        </p>
      </div>
    </div>
  );
}

// ─── Widget: Routing events ───────────────────────────────────────────────────

function RoutingEventsCard({ agencyId }: { agencyId: string }) {
  const { data: events = [], isLoading } = useQuery({
    queryKey: ["routing-events", agencyId],
    queryFn: () => fetchRoutingEvents(agencyId),
    refetchInterval: 30_000,
  });

  const iconForType = (type: RoutingEvent["type"]) => {
    switch (type) {
      case "EMS_ROUTED_IN":      return { icon: TrendingDown, color: "text-emerald-400" };
      case "EMS_ROUTED_OUT":     return { icon: TrendingUp,   color: "text-slate-400" };
      case "DIVERSION_STARTED":  return { icon: AlertTriangle,color: "text-rose-400" };
      case "DIVERSION_ENDED":    return { icon: CheckCircle2, color: "text-emerald-400" };
      case "ALERT_TRIGGERED":    return { icon: AlertTriangle,color: "text-yellow-400" };
      default:                   return { icon: Activity,     color: "text-slate-400" };
    }
  };

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-700/60 bg-slate-900">
      <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-3">
        <Route className="h-4 w-4 text-slate-500" />
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Routing Events</span>
        {events.length > 0 && (
          <span className="ml-auto rounded-full bg-slate-800 px-1.5 py-0.5 text-xs text-slate-400">
            {events.length}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex h-full items-center justify-center py-8">
            <Loader2 className="h-4 w-4 animate-spin text-slate-600" />
          </div>
        ) : events.length === 0 ? (
          <div className="flex h-full items-center justify-center py-12">
            <p className="text-xs text-slate-600">No routing events in last 24h</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/40">
            {events.map(event => {
              const { icon: Icon, color } = iconForType(event.type);
              return (
                <div key={event.eventId} className="flex items-start gap-3 px-4 py-3">
                  <Icon className={`mt-0.5 h-3.5 w-3.5 flex-shrink-0 ${color}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-slate-300">{event.description}</p>
                    <div className="mt-0.5 flex items-center gap-2">
                      <Clock className="h-3 w-3 text-slate-600" />
                      <p className="text-[10px] text-slate-600">
                        {new Date(event.occurredAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        {event.unitId && ` · ${event.unitId}`}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Widget: Regional capacity map ────────────────────────────────────────────

function RegionalCapacityMapCard({ agencyId }: { agencyId: string }) {
  const { data: facilities = [], isLoading } = useQuery({
    queryKey: ["regional-capacity", agencyId],
    queryFn: () => fetchRegionalCapacity(agencyId),
    refetchInterval: 60_000,
  });

  const summary = {
    open:      facilities.filter(f => f.diversionStatus === "OPEN").length,
    alert:     facilities.filter(f => f.diversionStatus === "ALERT").length,
    diversion: facilities.filter(f => f.diversionStatus === "DIVERSION").length,
  };

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-700/60 bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <Map className="h-4 w-4 text-slate-500" />
          <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Regional Capacity</span>
        </div>
        {facilities.length > 0 && (
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />{summary.open} open
            </span>
            <span className="flex items-center gap-1 text-yellow-400">
              <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />{summary.alert} alert
            </span>
            <span className="flex items-center gap-1 text-rose-400">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />{summary.diversion} diversion
            </span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-slate-600" />
          </div>
        ) : facilities.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-xs text-slate-600">No regional facilities configured</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
            {facilities.map(f => {
              const cfg = STATUS_CONFIG[f.diversionStatus];
              const pct = f.bedsTotal > 0 ? Math.round((f.bedsAvailable / f.bedsTotal) * 100) : 0;
              return (
                <div
                  key={f.facilityId}
                  className={`rounded-lg border p-3 ${cfg.border} ${cfg.bg}`}
                >
                  <div className="mb-2 flex items-start justify-between gap-1">
                    <p className="text-xs font-medium leading-tight text-white">{f.facilityName}</p>
                    <span className={`h-2 w-2 flex-shrink-0 rounded-full ${cfg.dot} mt-0.5`} />
                  </div>
                  <div className="mb-2">
                    <div className="h-1 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className={`h-full rounded-full ${
                          pct > 50 ? "bg-emerald-500" : pct > 25 ? "bg-yellow-500" : "bg-rose-500"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className={`text-base font-semibold tabular-nums ${cfg.text}`}>
                      {f.bedsAvailable}
                    </span>
                    <span className="text-xs text-slate-500">/{f.bedsTotal}</span>
                  </div>
                  {f.distanceMiles != null && (
                    <p className="mt-1 text-[10px] text-slate-600">{f.distanceMiles.toFixed(1)} mi</p>
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

// ─── Widget: Capacity trend ───────────────────────────────────────────────────

function CapacityTrendCard({ agencyId }: { agencyId: string }) {
  const { data: points = [], isLoading } = useQuery({
    queryKey: ["capacity-trend", agencyId],
    queryFn: () => fetchCapacityTrend(agencyId),
  });

  // Simple bar chart rendered with divs — no chart library dependency
  const max = Math.max(...points.map(p => p.bedsAvailable), 1);

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-700/60 bg-slate-900">
      <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-3">
        <Activity className="h-4 w-4 text-slate-500" />
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">7-Day Capacity Trend</span>
      </div>

      <div className="flex-1 p-4">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-slate-600" />
          </div>
        ) : points.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-xs text-slate-600">No trend data available</p>
          </div>
        ) : (
          <div className="flex h-full flex-col">
            {/* Chart area */}
            <div className="flex flex-1 items-end gap-1 px-2">
              {points.map((p, i) => {
                const heightPct = max > 0 ? (p.bedsAvailable / max) * 100 : 0;
                const barColor =
                  p.diversionStatus === "OPEN" ? "bg-emerald-600" :
                  p.diversionStatus === "ALERT" ? "bg-yellow-600" : "bg-rose-600";
                return (
                  <div key={i} className="group relative flex flex-1 flex-col items-center">
                    {/* Tooltip */}
                    <div className="pointer-events-none absolute bottom-full mb-2 hidden rounded bg-slate-800 px-2 py-1 text-xs text-white shadow group-hover:block">
                      <p>{p.bedsAvailable} beds</p>
                      <p className="text-slate-400">{new Date(p.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                    </div>
                    <div
                      className={`w-full rounded-t ${barColor} transition-all`}
                      style={{ height: `${heightPct}%`, minHeight: "4px" }}
                    />
                  </div>
                );
              })}
            </div>

            {/* X-axis labels — show day of week at start/middle/end */}
            <div className="flex justify-between px-2 pt-2">
              {[0, Math.floor(points.length / 2), points.length - 1].map(i => (
                <p key={i} className="text-[10px] text-slate-600">
                  {points[i] ? new Date(points[i].timestamp).toLocaleDateString("en-US", { weekday: "short" }) : ""}
                </p>
              ))}
            </div>

            {/* Legend */}
            <div className="mt-3 flex items-center justify-center gap-4 text-[10px] text-slate-500">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-emerald-600" />Open</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-yellow-600" />Alert</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-rose-600" />Diversion</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main dashboard ───────────────────────────────────────────────────────────

type Props = {
  agencyId: string;
  role: string;
  displayName: string;
};

export function HospitalDashboardClient({ agencyId, role, displayName }: Props) {
  const isCoordinator = isHospitalCoordinatorRole(role);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="min-h-full bg-slate-950 p-6">
      {/* Page header */}
      <div className="mb-6">
        <p className="text-xs font-medium uppercase tracking-widest text-teal-600">
          {isCoordinator ? "Hospital Coordinator" : "Facility Admin"}
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-white">
          {greeting}, {displayName.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          {hospitalRoleDescription(role)}
        </p>
      </div>

      {/* 12-column grid */}
      <div className="grid grid-cols-12 gap-4">
        {/* Row 1: Capacity status + Routing events */}
        <div className="col-span-12 xl:col-span-6" style={{ minHeight: 280 }}>
          <CapacityStatusCard agencyId={agencyId} />
        </div>
        <div className="col-span-12 xl:col-span-6" style={{ minHeight: 280 }}>
          <RoutingEventsCard agencyId={agencyId} />
        </div>

        {/* Row 2: Regional map — full width */}
        <div className="col-span-12" style={{ minHeight: 400 }}>
          <RegionalCapacityMapCard agencyId={agencyId} />
        </div>

        {/* Row 3: Trend chart */}
        <div className="col-span-12" style={{ minHeight: 200 }}>
          <CapacityTrendCard agencyId={agencyId} />
        </div>
      </div>
    </div>
  );
}
