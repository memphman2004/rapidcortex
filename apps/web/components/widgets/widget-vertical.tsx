"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, Bed, Camera, Globe, Map as MapIcon, QrCode, Users } from "lucide-react";
import { campusOrgCodeFromAgencyId } from "@/lib/campus/campus-access";
import { fetchCampusIncidents } from "@/lib/campus/campus-incidents-api";
import { extractVenueCode } from "@/lib/auth/post-login-redirect";
import { fetchHospitalCapacity } from "@/lib/hospital-routing/api";
import { fetchHospitalCapacityHistory } from "@/lib/hospital-portal/api";
import { fetchHospitalAnalytics } from "@/lib/hospital-routing/api";
import { fetchLocations } from "@/lib/locations-api";
import { fetchVenueIncidents } from "@/lib/venue/venue-incidents-api";
import {
  backendGet, EmptyState, WidgetError, WidgetShell, WidgetSkeleton, type WidgetProps,
} from "./widget-primitives";

export function CampusIncidentQueueWidget({ agencyId }: WidgetProps) {
  const campusCode = campusOrgCodeFromAgencyId(agencyId);
  const q = useQuery({
    queryKey: ["campus-incidents", campusCode],
    queryFn: () => fetchCampusIncidents(campusCode),
    refetchInterval: 15_000,
  });
  if (q.isLoading) return <WidgetSkeleton />;
  if (q.isError) return <WidgetError />;
  const incidents = [...(q.data ?? [])].sort((a, b) => {
    if (a.status === "open" && b.status !== "open") return -1;
    if (b.status === "open" && a.status !== "open") return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
  return (
    <WidgetShell title="Campus Incidents" icon={Activity} count={incidents.length}>
      {incidents.length === 0 ? (
        <EmptyState message="No campus incidents" />
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800">
              <th className="px-4 py-2 text-left text-xs text-slate-500">Type</th>
              <th className="px-4 py-2 text-left text-xs text-slate-500">Zone</th>
              <th className="px-4 py-2 text-left text-xs text-slate-500">Status</th>
              <th className="px-4 py-2 text-left text-xs text-slate-500">Opened</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/40">
            {incidents.slice(0, 12).map((incident) => (
              <tr key={incident.id} className="hover:bg-slate-800/30">
                <td className="px-4 py-2.5 text-white">{incident.type}</td>
                <td className="px-4 py-2.5 text-xs text-slate-400">{incident.zoneCode ?? incident.roomCode ?? "—"}</td>
                <td className="px-4 py-2.5 text-xs text-slate-400">{incident.status}</td>
                <td className="px-4 py-2.5 text-xs text-slate-500">
                  {new Date(incident.createdAt).toLocaleTimeString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </WidgetShell>
  );
}

export function QrScanActivityWidget({ agencyId }: WidgetProps) {
  const q = useQuery({
    queryKey: ["qr-activity", agencyId],
    queryFn: () => fetchLocations(agencyId, { active: true }),
    refetchInterval: 60_000,
  });
  if (q.isLoading) return <WidgetSkeleton />;
  const locations = [...(q.data ?? [])].sort((a, b) => (b.scanCount ?? 0) - (a.scanCount ?? 0));
  return (
    <WidgetShell title="QR Scan Activity" icon={QrCode}>
      {locations.length === 0 ? (
        <EmptyState message="No QR locations" />
      ) : (
        <div className="divide-y divide-slate-800/40">
          {locations.slice(0, 12).map((loc) => (
            <div key={loc.rcli} className="flex items-center justify-between px-4 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-xs text-white">{loc.locationName}</p>
                <p className="text-[10px] text-slate-600">{loc.zoneCode}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-white">{loc.scanCount ?? 0}</p>
                <p className="text-[10px] text-slate-600">
                  {loc.lastScannedAt ? new Date(loc.lastScannedAt).toLocaleDateString() : "—"}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </WidgetShell>
  );
}

export function CampusUserActivityWidget({ agencyId }: WidgetProps) {
  const q = useQuery({
    queryKey: ["activity-feed", agencyId, "campus"],
    queryFn: () =>
      backendGet<{ events?: Array<{ eventId: string; summary: string; timestamp: string }> }>(
        `/api/agencies/${encodeURIComponent(agencyId)}/audit?limit=12`,
      ),
  });
  if (q.isLoading) return <WidgetSkeleton />;
  const events = q.data?.events ?? [];
  return (
    <WidgetShell title="Campus Activity" icon={Users}>
      {events.length === 0 ? (
        <EmptyState message="No recent activity" />
      ) : (
        <div className="divide-y divide-slate-800/40">
          {events.map((e) => (
            <div key={e.eventId} className="px-4 py-2.5">
              <p className="line-clamp-2 text-xs text-slate-300">{e.summary}</p>
              <p className="text-[10px] text-slate-600">{new Date(e.timestamp).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}
    </WidgetShell>
  );
}

export function CapacityTrendWidget({ agencyId }: WidgetProps) {
  const q = useQuery({
    queryKey: ["capacity-trend", agencyId],
    queryFn: () => fetchHospitalAnalytics(agencyId, 14),
  });
  if (q.isLoading) return <WidgetSkeleton />;
  const days = q.data ?? [];
  const max = Math.max(...days.map((d) => d.capacity?.avgErBedsAvailable ?? 0), 1);
  return (
    <WidgetShell title="Capacity Trend" icon={Bed}>
      {days.length === 0 ? (
        <EmptyState message="No capacity history" />
      ) : (
        <div className="flex h-48 items-end gap-1 p-4">
          {days.map((d) => {
            const h = Math.round(((d.capacity?.avgErBedsAvailable ?? 0) / max) * 100);
            return (
              <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                <div className="w-full rounded-t bg-teal-600/70" style={{ height: `${h}%`, minHeight: 4 }} />
                <span className="text-[8px] text-slate-600">
                  {new Date(d.date).toLocaleDateString("en-US", { month: "numeric", day: "numeric" })}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </WidgetShell>
  );
}

export function RegionalCapacityMapWidget({ agencyId }: WidgetProps) {
  const q = useQuery({
    queryKey: ["regional-capacity", agencyId],
    queryFn: () => fetchHospitalCapacity(),
    refetchInterval: 60_000,
  });
  if (q.isLoading) return <WidgetSkeleton />;
  const facilities = q.data ?? [];
  return (
    <WidgetShell title="Regional Capacity" icon={MapIcon}>
      {facilities.length === 0 ? (
        <EmptyState message="No regional capacity data" />
      ) : (
        <div className="grid gap-2 p-4 sm:grid-cols-2">
          {facilities.map((f) => {
            const available = f.availability?.erBeds?.available ?? 0;
            const total = f.availability?.erBeds?.total ?? 0;
            const onDiversion = f.diversion?.isOnDiversion;
            return (
              <div
                key={f.hospitalId}
                className={`rounded-lg border px-3 py-2.5 ${
                  onDiversion
                    ? "border-rose-800/50 bg-rose-950/20"
                    : available < 3
                      ? "border-yellow-800/50 bg-yellow-950/20"
                      : "border-slate-800 bg-slate-800/30"
                }`}
              >
                <p className="truncate text-xs font-medium text-white">{f.hospitalId}</p>
                <p className="mt-1 text-lg font-semibold text-white">{available}</p>
                <p className="text-[10px] text-slate-500">
                  {onDiversion ? "DIVERSION" : "OPEN"} · {total} total
                </p>
              </div>
            );
          })}
        </div>
      )}
    </WidgetShell>
  );
}

export function RoutingEventsWidget({ agencyId }: WidgetProps) {
  const q = useQuery({
    queryKey: ["routing-events", agencyId],
    queryFn: () =>
      backendGet<{ events?: Array<{ id: string; hospitalId: string; incidentId: string; createdAt: string }> }>(
        `/api/hospital/${encodeURIComponent(agencyId)}/routing/events?limit=15`,
      ),
    refetchInterval: 30_000,
  });
  if (q.isLoading) return <WidgetSkeleton />;
  const events = q.data?.events ?? [];
  return (
    <WidgetShell title="Routing Events" icon={Globe} count={events.length}>
      {events.length === 0 ? (
        <EmptyState message="No routing events" />
      ) : (
        <div className="divide-y divide-slate-800/40">
          {events.map((e) => (
            <div key={e.id} className="px-4 py-2.5">
              <p className="text-xs text-white">{e.incidentId}</p>
              <p className="text-[10px] text-slate-600">
                → {e.hospitalId} · {new Date(e.createdAt).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </WidgetShell>
  );
}

export function MyCapacityHistoryWidget({ agencyId }: WidgetProps) {
  const q = useQuery({
    queryKey: ["capacity-history", agencyId],
    queryFn: () => fetchHospitalCapacityHistory(12),
  });
  if (q.isLoading) return <WidgetSkeleton />;
  const rows = q.data ?? [];
  return (
    <WidgetShell title="My Updates" icon={Bed}>
      {rows.length === 0 ? (
        <EmptyState message="No capacity updates yet" />
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800">
              <th className="px-4 py-2 text-left text-xs text-slate-500">When</th>
              <th className="px-4 py-2 text-left text-xs text-slate-500">Available</th>
              <th className="px-4 py-2 text-left text-xs text-slate-500">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/40">
            {rows.map((row, idx) => (
              <tr key={`${row.timestamp}-${idx}`}>
                <td className="px-4 py-2 text-xs text-slate-400">
                  {row.timestamp ? new Date(row.timestamp).toLocaleString() : "—"}
                </td>
                <td className="px-4 py-2 text-white">{row.availability?.erBeds?.available ?? "—"}</td>
                <td className="px-4 py-2 text-xs text-slate-500">
                  {row.diversion?.isOnDiversion ? "DIVERSION" : "OPEN"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </WidgetShell>
  );
}

export function StaffBoardWidget({ agencyId }: WidgetProps) {
  const venueCode = extractVenueCode(agencyId);
  const q = useQuery({
    queryKey: ["venue-staff", agencyId, venueCode],
    queryFn: async () => {
      const stats = await backendGet<{ staffOnDuty?: number }>(
        `/api/venue/${encodeURIComponent(agencyId)}/stats/live`,
      );
      const incidents = await fetchVenueIncidents(venueCode).catch(() => []);
      const staff = new Map<string, { name: string; assignments: number }>();
      for (const inc of incidents) {
        if (!inc.assignedTo) continue;
        const cur = staff.get(inc.assignedTo) ?? { name: inc.assignedTo, assignments: 0 };
        cur.assignments += 1;
        staff.set(inc.assignedTo, cur);
      }
      return { onDuty: stats?.staffOnDuty ?? staff.size, staff: [...staff.values()] };
    },
    refetchInterval: 30_000,
  });
  if (q.isLoading) return <WidgetSkeleton />;
  const staff = q.data?.staff ?? [];
  return (
    <WidgetShell title="Staff Board" icon={Users} count={q.data?.onDuty}>
      {staff.length === 0 ? (
        <EmptyState message="No staff assignments" />
      ) : (
        <div className="divide-y divide-slate-800/40">
          {staff.map((s) => (
            <div key={s.name} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-xs text-white">{s.name}</span>
              <span className="text-[10px] text-slate-500">{s.assignments} active</span>
            </div>
          ))}
        </div>
      )}
    </WidgetShell>
  );
}

export function CameraGridWidget({ agencyId }: WidgetProps) {
  const venueCode = extractVenueCode(agencyId);
  const q = useQuery({
    queryKey: ["venue-cameras", agencyId, venueCode],
    queryFn: async () => {
      const stats = await backendGet<{ camerasOnline?: number }>(
        `/api/venue/${encodeURIComponent(agencyId)}/stats/live`,
      );
      const incidents = await fetchVenueIncidents(venueCode).catch(() => []);
      const cameraSet = new Set<string>();
      for (const inc of incidents) {
        for (const ref of inc.cameraRefs ?? []) cameraSet.add(ref);
      }
      const cameras = [...cameraSet];
      const online = stats?.camerasOnline ?? cameras.length;
      return { cameras, online };
    },
    refetchInterval: 30_000,
  });
  if (q.isLoading) return <WidgetSkeleton />;
  const cameras = q.data?.cameras ?? [];
  return (
    <WidgetShell title="Cameras" icon={Camera} count={q.data?.online}>
      {cameras.length === 0 ? (
        <EmptyState message="No cameras linked to active incidents" />
      ) : (
        <div className="grid grid-cols-2 gap-2 p-4">
          {cameras.slice(0, 8).map((cam) => (
            <div
              key={cam}
              className="flex aspect-video flex-col items-center justify-center rounded-lg border border-slate-800 bg-slate-950"
            >
              <Camera className="h-5 w-5 text-emerald-500" />
              <p className="mt-2 font-mono text-[10px] text-slate-400">{cam}</p>
              <p className="text-[9px] text-emerald-500">online</p>
            </div>
          ))}
        </div>
      )}
    </WidgetShell>
  );
}

export function VenueHeatmapWidget({ agencyId }: WidgetProps) {
  const venueCode = extractVenueCode(agencyId);
  const q = useQuery({
    queryKey: ["venue-zones", agencyId, venueCode],
    queryFn: async () => {
      const incidents = await fetchVenueIncidents(venueCode);
      const zones = new Map<string, number>();
      for (const inc of incidents) {
        const zone = inc.zoneCode ?? "unknown";
        if (["open", "assigned", "responding"].includes(inc.status)) {
          zones.set(zone, (zones.get(zone) ?? 0) + 1);
        }
      }
      return [...zones.entries()];
    },
    refetchInterval: 30_000,
  });
  if (q.isLoading) return <WidgetSkeleton />;
  const zones = q.data ?? [];
  const max = Math.max(...zones.map(([, c]) => c), 1);
  return (
    <WidgetShell title="Incident Heatmap" icon={MapIcon}>
      {zones.length === 0 ? (
        <EmptyState message="No zone activity" />
      ) : (
        <div className="grid grid-cols-4 gap-2 p-4">
          {zones.map(([zone, count]) => {
            const intensity = count / max;
            return (
              <div
                key={zone}
                className="rounded-md border border-slate-800 p-2 text-center"
                style={{ backgroundColor: `rgba(249, 115, 22, ${0.15 + intensity * 0.55})` }}
              >
                <p className="text-[10px] font-medium text-white">{zone}</p>
                <p className="text-xs text-orange-200">{count}</p>
              </div>
            );
          })}
        </div>
      )}
    </WidgetShell>
  );
}
