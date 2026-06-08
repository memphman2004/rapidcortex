"use client";

/** Core operational widgets (original implementations). */

import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle, AlertTriangle, BarChart3, Bed, Camera, CheckCircle2, Circle,
  Clock, Globe, MessageSquare, PhoneCall, Shield, Users, Wifi, WifiOff, Zap,
} from "lucide-react";
import {
  StatCard,
  StatusDot,
  WidgetError,
  WidgetShell,
  WidgetSkeleton,
  type WidgetProps,
} from "./widget-primitives";

// ─── SLA Bar ─────────────────────────────────────────────────────────────────

export function SLABarWidget({ agencyId }: WidgetProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["shift-sla", agencyId],
    queryFn: async () => {
      const r = await fetch(`/api/backend/api/agencies/${agencyId}/sla/current`, { credentials: "include" });
      return r.ok ? r.json() : null;
    },
    refetchInterval: 30_000,
  });

  if (isLoading) return <WidgetSkeleton />;

  const metrics = [
    { label: "Avg answer time", value: data?.avgAnswerTimeSeconds ? `${data.avgAnswerTimeSeconds}s` : "—", ok: (data?.avgAnswerTimeSeconds ?? 999) < 15 },
    { label: "Abandonment rate", value: data?.abandonmentRate != null ? `${(data.abandonmentRate * 100).toFixed(1)}%` : "—", ok: (data?.abandonmentRate ?? 1) < 0.05 },
    { label: "Avg handle time", value: data?.avgHandleTimeSeconds ? `${Math.round(data.avgHandleTimeSeconds / 60)}m` : "—", ok: true },
    { label: "Calls this shift", value: data?.callsThisShift ?? "—", ok: true },
    { label: "Active dispatchers", value: data?.activeDispatchers ?? "—", ok: true },
  ];

  return (
    <div className="flex items-center gap-6 rounded-xl border border-slate-700/60 bg-slate-900 px-5 py-3">
      {metrics.map(m => (
        <div key={m.label} className="flex items-center gap-2">
          <StatusDot ok={m.ok} />
          <div>
            <p className="text-[10px] uppercase tracking-wide text-slate-500">{m.label}</p>
            <p className="text-sm font-semibold text-white">{String(m.value)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Active calls grid ────────────────────────────────────────────────────────

export function ActiveCallsGridWidget({ agencyId }: WidgetProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["active-calls", agencyId],
    queryFn: async () => {
      const r = await fetch(`/api/backend/api/agencies/${agencyId}/incidents?status=active`, { credentials: "include" });
      return r.ok ? r.json() : null;
    },
    refetchInterval: 10_000,
  });

  if (isLoading) return <WidgetSkeleton />;
  if (isError) return <WidgetError />;

  const calls: Array<{ incidentId: string; dispatcherName: string; natureCode: string; durationSeconds: number; flagged: boolean }> = data?.incidents ?? [];

  return (
    <WidgetShell title="Active Calls" icon={PhoneCall} count={calls.length}>
      {calls.length === 0 ? (
        <div className="flex h-full items-center justify-center py-12">
          <p className="text-xs text-slate-600">No active calls</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-800/60">
          {calls.map(call => (
            <div key={call.incidentId} className="flex items-center justify-between px-4 py-3 hover:bg-slate-800/30">
              <div className="flex items-center gap-3">
                {call.flagged && <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />}
                <div>
                  <p className="text-sm font-medium text-white">{call.dispatcherName}</p>
                  <p className="text-xs text-slate-500">{call.natureCode || "Unknown type"}</p>
                </div>
              </div>
              <span className="text-xs tabular-nums text-slate-400">
                {Math.floor(call.durationSeconds / 60)}:{String(call.durationSeconds % 60).padStart(2, "0")}
              </span>
            </div>
          ))}
        </div>
      )}
    </WidgetShell>
  );
}

// ─── Incident queue ───────────────────────────────────────────────────────────

export function IncidentQueueWidget({ agencyId }: WidgetProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["incidents", agencyId],
    queryFn: async () => {
      const r = await fetch(`/api/backend/api/agencies/${agencyId}/incidents?status=open&limit=20`, { credentials: "include" });
      return r.ok ? r.json() : null;
    },
    refetchInterval: 15_000,
  });

  if (isLoading) return <WidgetSkeleton />;
  if (isError) return <WidgetError />;

  type Incident = { incidentId: string; natureCode: string; createdAt: string; priority: "high" | "medium" | "low"; assignedTo: string | null };
  const incidents: Incident[] = data?.incidents ?? [];
  const priorityColor = { high: "text-rose-400", medium: "text-yellow-400", low: "text-slate-400" };

  return (
    <WidgetShell title="Incident Queue" icon={AlertCircle} count={incidents.length}>
      {incidents.length === 0 ? (
        <div className="flex h-full items-center justify-center py-12">
          <p className="text-xs text-slate-600">No open incidents</p>
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800">
              <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Type</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Priority</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Opened</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Assigned</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/40">
            {incidents.map(i => (
              <tr key={i.incidentId} className="hover:bg-slate-800/30">
                <td className="px-4 py-2.5 text-white">{i.natureCode || "Unknown"}</td>
                <td className={`px-4 py-2.5 text-xs font-medium ${priorityColor[i.priority] ?? "text-slate-400"}`}>
                  {i.priority}
                </td>
                <td className="px-4 py-2.5 text-xs text-slate-400">
                  {new Date(i.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                </td>
                <td className="px-4 py-2.5 text-xs text-slate-400">{i.assignedTo ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </WidgetShell>
  );
}

// ─── Integration health ───────────────────────────────────────────────────────

export function IntegrationHealthWidget({ agencyId }: WidgetProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["integration-health", agencyId],
    queryFn: async () => {
      const r = await fetch(`/api/backend/api/agencies/${agencyId}/integrations/health`, { credentials: "include" });
      return r.ok ? r.json() : null;
    },
    refetchInterval: 60_000,
  });

  if (isLoading) return <WidgetSkeleton />;

  type Integration = { name: string; type: string; status: "connected" | "error" | "degraded" | "offline"; lastSyncAt: string | null };
  const integrations: Integration[] = data?.integrations ?? [];
  const statusColor = { connected: "text-emerald-400", error: "text-rose-400", degraded: "text-yellow-400", offline: "text-slate-500" };
  const StatusIcon = { connected: CheckCircle2, error: AlertCircle, degraded: AlertTriangle, offline: WifiOff };

  return (
    <WidgetShell title="Integration Health" icon={Wifi}>
      {integrations.length === 0 ? (
        <div className="px-4 py-8 text-center text-xs text-slate-600">No integrations configured</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 p-4">
          {integrations.map(i => {
            const Icon = StatusIcon[i.status] ?? Circle;
            return (
              <div key={i.name} className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-800/40 px-3 py-2.5">
                <Icon className={`h-4 w-4 flex-shrink-0 ${statusColor[i.status]}`} />
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-white">{i.name}</p>
                  <p className="text-[10px] text-slate-500">{i.status}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </WidgetShell>
  );
}

// ─── Platform health bar ──────────────────────────────────────────────────────

export function PlatformHealthBarWidget({ agencyId }: WidgetProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["platform-health"],
    queryFn: async () => {
      const r = await fetch("/api/backend/api/platform/health", { credentials: "include" });
      return r.ok ? r.json() : null;
    },
    refetchInterval: 30_000,
  });

  if (isLoading) return <WidgetSkeleton />;

  const metrics = [
    { label: "API p99", value: data?.apiP99Ms ? `${data.apiP99Ms}ms` : "—", ok: (data?.apiP99Ms ?? 999) < 500 },
    { label: "Lambda errors", value: data?.lambdaErrorRate ? `${(data.lambdaErrorRate * 100).toFixed(2)}%` : "0%", ok: (data?.lambdaErrorRate ?? 0) < 0.01 },
    { label: "DDB throttles", value: data?.ddbThrottles ?? 0, ok: (data?.ddbThrottles ?? 0) === 0 },
    { label: "Cognito errors", value: data?.cognitoErrors ?? 0, ok: (data?.cognitoErrors ?? 0) === 0 },
    { label: "Alarms in ALARM", value: data?.activeAlarms ?? 0, ok: (data?.activeAlarms ?? 0) === 0 },
  ];

  const allOk = metrics.every(m => m.ok);

  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-700/60 bg-slate-900 px-5 py-3">
      <div className="flex items-center gap-2">
        <div className={`h-2 w-2 rounded-full ${allOk ? "bg-emerald-400" : "bg-rose-500"}`} />
        <span className="text-xs font-medium text-slate-400">
          {allOk ? "All systems nominal" : "Degraded signals detected"}
        </span>
      </div>
      <div className="flex items-center gap-6">
        {metrics.map(m => (
          <div key={m.label} className="flex items-center gap-1.5">
            <StatusDot ok={m.ok} />
            <div>
              <p className="text-[10px] text-slate-600">{m.label}</p>
              <p className="text-xs font-medium text-white">{String(m.value)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Recent activity feed ─────────────────────────────────────────────────────

export function RecentActivityWidget({ agencyId }: WidgetProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["activity-feed", agencyId],
    queryFn: async () => {
      const r = await fetch(`/api/backend/api/agencies/${agencyId}/audit?limit=20`, { credentials: "include" });
      return r.ok ? r.json() : null;
    },
  });

  if (isLoading) return <WidgetSkeleton />;

  type Event = { eventId: string; type: string; actor: string; timestamp: string; summary: string };
  const events: Event[] = data?.events ?? [];

  return (
    <WidgetShell title="Recent Activity" icon={Clock}>
      <div className="divide-y divide-slate-800/40">
        {events.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-600">No recent activity</div>
        ) : events.map(e => (
          <div key={e.eventId} className="flex items-start gap-3 px-4 py-3">
            <div className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-slate-600" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-slate-300">{e.summary}</p>
              <p className="mt-0.5 text-[10px] text-slate-600">
                {e.actor} · {new Date(e.timestamp).toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}
      </div>
    </WidgetShell>
  );
}

// ─── QA review queue ─────────────────────────────────────────────────────────

export function QaReviewQueueWidget({ agencyId }: WidgetProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["qa-queue", agencyId],
    queryFn: async () => {
      const r = await fetch(`/api/backend/api/agencies/${agencyId}/qa/queue?status=pending&limit=15`, { credentials: "include" });
      return r.ok ? r.json() : null;
    },
  });

  if (isLoading) return <WidgetSkeleton />;
  if (isError) return <WidgetError />;

  type QaItem = { sessionId: string; incidentId: string; dispatcherName: string; createdAt: string; ageHours: number };
  const items: QaItem[] = data?.sessions ?? [];

  return (
    <WidgetShell title="Review Queue" icon={CheckCircle2} count={items.length}>
      {items.length === 0 ? (
        <div className="flex h-full items-center justify-center py-12">
          <p className="text-xs text-slate-600">Queue is clear</p>
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800">
              <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Dispatcher</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Call date</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Age</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/40">
            {items.map(item => (
              <tr key={item.sessionId} className="hover:bg-slate-800/30">
                <td className="px-4 py-2.5 text-white">{item.dispatcherName}</td>
                <td className="px-4 py-2.5 text-xs text-slate-400">
                  {new Date(item.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </td>
                <td className="px-4 py-2.5">
                  <span className={`text-xs font-medium ${item.ageHours > 48 ? "text-rose-400" : item.ageHours > 24 ? "text-yellow-400" : "text-slate-400"}`}>
                    {item.ageHours}h
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </WidgetShell>
  );
}

// ─── Capacity status ──────────────────────────────────────────────────────────

export function CapacityStatusWidget({ agencyId }: WidgetProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["facility-capacity", agencyId],
    queryFn: async () => {
      const r = await fetch(`/api/backend/api/hospital/${agencyId}/capacity/current`, { credentials: "include" });
      return r.ok ? r.json() : null;
    },
    refetchInterval: 60_000,
  });

  if (isLoading) return <WidgetSkeleton />;

  const status = data?.diversionStatus ?? "UNKNOWN";
  const statusColor = { OPEN: "text-emerald-400 border-emerald-700/50 bg-emerald-900/20", ALERT: "text-yellow-400 border-yellow-700/50 bg-yellow-900/20", DIVERSION: "text-rose-400 border-rose-700/50 bg-rose-900/20", UNKNOWN: "text-slate-400 border-slate-700 bg-slate-900" };

  return (
    <WidgetShell title="Facility Status" icon={Bed}>
      <div className="flex flex-col items-center justify-center p-6">
        <div className={`rounded-xl border px-8 py-4 text-center ${statusColor[status as keyof typeof statusColor] ?? statusColor.UNKNOWN}`}>
          <p className="text-3xl font-bold">{status}</p>
          <p className="mt-1 text-sm opacity-70">{data?.bedsAvailable ?? "—"} beds available</p>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Updated {data?.lastUpdatedAt ? new Date(data.lastUpdatedAt).toLocaleTimeString() : "—"}
        </p>
      </div>
    </WidgetShell>
  );
}

// ─── Guest reports feed ───────────────────────────────────────────────────────

export function GuestReportsFeedWidget({ agencyId }: WidgetProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["guest-reports", agencyId],
    queryFn: async () => {
      const r = await fetch(`/api/backend/api/venue/${agencyId}/guest-reports?status=open&limit=20`, { credentials: "include" });
      return r.ok ? r.json() : null;
    },
    refetchInterval: 15_000,
  });

  if (isLoading) return <WidgetSkeleton />;
  if (isError) return <WidgetError />;

  type Report = { reportId: string; message: string; submittedAt: string; zone: string | null; assignedTo: string | null };
  const reports: Report[] = data?.reports ?? [];

  return (
    <WidgetShell title="Guest Reports" icon={MessageSquare} count={reports.length}>
      {reports.length === 0 ? (
        <div className="flex h-full items-center justify-center py-12">
          <p className="text-xs text-slate-600">No open reports</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-800/40">
          {reports.map(r => (
            <div key={r.reportId} className="px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <p className="line-clamp-2 flex-1 text-xs text-slate-300">{r.message}</p>
                {r.zone && (
                  <span className="flex-shrink-0 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
                    {r.zone}
                  </span>
                )}
              </div>
              <p className="mt-1 text-[10px] text-slate-600">
                {new Date(r.submittedAt).toLocaleTimeString()} · {r.assignedTo ?? "Unassigned"}
              </p>
            </div>
          ))}
        </div>
      )}
    </WidgetShell>
  );
}

// ─── Venue live stats row ─────────────────────────────────────────────────────

export function VenueLiveStatsRowWidget({ agencyId }: WidgetProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["venue-stats", agencyId],
    queryFn: async () => {
      const r = await fetch(`/api/backend/api/venue/${agencyId}/stats/live`, { credentials: "include" });
      return r.ok ? r.json() : null;
    },
    refetchInterval: 15_000,
  });

  if (isLoading) return <WidgetSkeleton />;

  const stats = [
    { label: "Active incidents",   value: data?.openIncidents ?? 0,     icon: AlertCircle, valueColor: data?.openIncidents > 0 ? "text-rose-400" : "text-white" },
    { label: "Open guest reports", value: data?.openGuestReports ?? 0,  icon: MessageSquare, valueColor: "text-white" },
    { label: "Staff on duty",      value: data?.staffOnDuty ?? 0,       icon: Users, valueColor: "text-white" },
    { label: "Cameras online",     value: data?.camerasOnline ?? 0,     icon: Camera, valueColor: "text-white" },
  ];

  return (
    <div className="grid grid-cols-4 gap-3">
      {stats.map(s => (
        <StatCard
          key={s.label}
          label={s.label}
          value={s.value}
          icon={s.icon}
          valueColor={s.valueColor}
        />
      ))}
    </div>
  );
}

// ─── Campus zone status ───────────────────────────────────────────────────────

export function CampusZoneStatusWidget({ agencyId }: WidgetProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["campus-zones", agencyId],
    queryFn: async () => {
      const r = await fetch(`/api/backend/api/campus/${agencyId}/zones`, { credentials: "include" });
      return r.ok ? r.json() : null;
    },
    refetchInterval: 30_000,
  });

  if (isLoading) return <WidgetSkeleton />;

  type Zone = { zoneId: string; name: string; activeIncidents: number; lastActivityAt: string | null };
  const zones: Zone[] = data?.zones ?? [];

  return (
    <WidgetShell title="Zone Status" icon={Globe}>
      <div className="divide-y divide-slate-800/40">
        {zones.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-600">No zones configured</div>
        ) : zones.map(z => (
          <div key={z.zoneId} className="flex items-center justify-between px-4 py-3">
            <p className="text-sm text-white">{z.name}</p>
            {z.activeIncidents > 0 ? (
              <span className="rounded-full bg-rose-900/50 px-2 py-0.5 text-xs font-medium text-rose-400">
                {z.activeIncidents} active
              </span>
            ) : (
              <span className="text-xs text-slate-600">Clear</span>
            )}
          </div>
        ))}
      </div>
    </WidgetShell>
  );
}

// ─── Capacity quick update (hospital staff) ───────────────────────────────────

export function CapacityQuickUpdateWidget({ agencyId }: WidgetProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["facility-capacity", agencyId],
    queryFn: async () => {
      const r = await fetch(`/api/backend/api/hospital/${agencyId}/capacity/current`, { credentials: "include" });
      return r.ok ? r.json() : null;
    },
  });

  if (isLoading) return <WidgetSkeleton />;

  // The actual update form is in CampusSettingsClient — this widget links to it
  return (
    <WidgetShell title="Bed Capacity" icon={Bed}>
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <p className="text-5xl font-bold text-white tabular-nums">
          {data?.bedsAvailable ?? "—"}
        </p>
        <p className="mt-2 text-sm text-slate-400">beds available</p>
        <p className="mt-1 text-xs text-slate-600">
          of {data?.bedsTotal ?? "—"} total · Last updated {data?.lastUpdatedAt ? new Date(data.lastUpdatedAt).toLocaleTimeString() : "—"}
        </p>
        <a
          href={`/hospital-staff/capacity/update`}
          className="mt-6 flex items-center gap-2 rounded-lg bg-teal-800 px-4 py-2 text-sm font-medium text-teal-100 hover:bg-teal-700"
        >
          <Bed className="h-4 w-4" />
          Update capacity
        </a>
      </div>
    </WidgetShell>
  );
}

// ─── Quick links (agency admin) ───────────────────────────────────────────────

export function QuickLinksAdminWidget({ agencyId }: WidgetProps) {
  const links = [
    { label: "Add user",          href: "admin/users/new",        icon: Users },
    { label: "View reports",      href: "reports",                 icon: BarChart3 },
    { label: "Check integrations",href: "admin/integrations",     icon: Wifi },
    { label: "Audit log",         href: "audit",                   icon: Clock },
    { label: "Compliance",        href: "admin/compliance",        icon: Shield },
    { label: "Settings",          href: "admin/settings",          icon: Zap },
  ];

  return (
    <WidgetShell title="Quick Links" icon={Zap}>
      <div className="grid grid-cols-2 gap-2 p-4">
        {links.map(l => (
          <a
            key={l.label}
            href={l.href}
            className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-800/40 px-3 py-2.5 text-xs text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            <l.icon className="h-3.5 w-3.5 text-slate-500" />
            {l.label}
          </a>
        ))}
      </div>
    </WidgetShell>
  );
}
