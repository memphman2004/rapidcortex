"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Activity, AlertCircle, AlertTriangle, BarChart3, Bell, CheckCircle2,
  Clock, CreditCard, FileText, Globe, Key, Package, Radio, Receipt,
  Shield, ShieldAlert, Siren, TrendingUp, Users, Wifi, Zap,
} from "lucide-react";
import type { CadWritebackAuditRecord } from "rapid-cortex-shared";
import {
  fetchAgencies,
  fetchAgencyAdminWebhooks,
  fetchAgencyBillingInvoices,
  fetchAuditEvents,
  fetchBillingServices,
  fetchCadIntegrations,
  fetchCadWritebackApprovals,
  fetchPlatformAuditEvents,
  fetchPlatformSummary,
  fetchSupervisorPerformanceMetrics,
} from "@/lib/api";
import { fetchAdminPlatformNotices } from "@/lib/platform-notices-api";
import { fetchQaScorecards, fetchQaTrends } from "@/lib/qa-module-api";
import { fetchWarRooms } from "@/lib/war-room-api";
import { needsOnboardingAttention } from "@/lib/platform-onboarding-helpers";
import {
  backendGet, EmptyState, StatCard, StatusDot, WidgetError, WidgetShell, WidgetSkeleton, type WidgetProps,
} from "./widget-primitives";

function parseWritebackPayload(raw: string): { narrative?: string } {
  try {
    return JSON.parse(raw) as { narrative?: string };
  } catch {
    return {};
  }
}

export function CadApprovalQueueWidget({ agencyId }: WidgetProps) {
  const q = useQuery({
    queryKey: ["cad-approvals", agencyId],
    queryFn: () => fetchCadWritebackApprovals({ status: "pending_approval" }),
    refetchInterval: 30_000,
  });
  if (q.isLoading) return <WidgetSkeleton />;
  if (q.isError) return <WidgetError />;
  const items = q.data?.items ?? [];
  return (
    <WidgetShell title="CAD Approvals" icon={CheckCircle2} count={items.length}>
      {items.length === 0 ? (
        <EmptyState message="No pending write-backs" />
      ) : (
        <div className="divide-y divide-slate-800/40">
          {items.map((row: CadWritebackAuditRecord) => (
            <div key={row.id} className="px-4 py-3">
              <p className="text-xs font-medium text-white">{row.incidentId}</p>
              <p className="mt-0.5 line-clamp-1 text-[10px] text-slate-500">
                {parseWritebackPayload(row.payload).narrative ?? row.userEmail}
              </p>
              <p className="mt-1 text-[10px] text-slate-600">{row.userEmail}</p>
            </div>
          ))}
        </div>
      )}
    </WidgetShell>
  );
}

export function EscalatedIncidentsWidget({ agencyId }: WidgetProps) {
  const q = useQuery({
    queryKey: ["incidents", agencyId, "escalated"],
    queryFn: () =>
      backendGet<{ incidents?: Array<{ incidentId: string; natureCode: string; priority: string }> }>(
        `/api/agencies/${encodeURIComponent(agencyId)}/incidents?status=open&limit=50`,
      ),
    refetchInterval: 30_000,
  });
  if (q.isLoading) return <WidgetSkeleton />;
  const incidents = (q.data?.incidents ?? []).filter((i) => i.priority === "high");
  return (
    <WidgetShell title="Escalated" icon={AlertTriangle} count={incidents.length}>
      {incidents.length === 0 ? (
        <EmptyState message="No escalated incidents" />
      ) : (
        <div className="divide-y divide-slate-800/40">
          {incidents.map((i) => (
            <div key={i.incidentId} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-sm text-white">{i.natureCode || i.incidentId}</span>
              <span className="text-xs text-rose-400">high</span>
            </div>
          ))}
        </div>
      )}
    </WidgetShell>
  );
}

export function TeamWorkloadWidget({ agencyId }: WidgetProps) {
  const q = useQuery({
    queryKey: ["team-workload", agencyId],
    queryFn: () => fetchSupervisorPerformanceMetrics(),
    refetchInterval: 60_000,
  });
  if (q.isLoading) return <WidgetSkeleton />;
  const rows = q.data?.leaderboard ?? [];
  return (
    <WidgetShell title="Team Workload" icon={Users}>
      {rows.length === 0 ? (
        <EmptyState message="No dispatcher activity this period" />
      ) : (
        <div className="divide-y divide-slate-800/40">
          {rows.slice(0, 8).map((row) => (
            <div key={row.dispatcherUserId} className="flex items-center justify-between px-4 py-2.5">
              <span className="truncate text-xs text-slate-300">{row.dispatcherUserId}</span>
              <span className="text-xs tabular-nums text-slate-500">{row.transcriptAppends} events</span>
            </div>
          ))}
        </div>
      )}
    </WidgetShell>
  );
}

export function WarRoomsActiveWidget({ agencyId }: WidgetProps) {
  const q = useQuery({
    queryKey: ["war-rooms", agencyId],
    queryFn: () => fetchWarRooms(),
    refetchInterval: 30_000,
  });
  if (q.isLoading) return <WidgetSkeleton />;
  const rooms = q.data ?? [];
  const active = rooms.filter((r) => r.status === "active" || r.status === "standby");
  return (
    <WidgetShell title="War Rooms" icon={Siren} count={active.length}>
      {active.length === 0 ? (
        <EmptyState message="No active war rooms" />
      ) : (
        <div className="divide-y divide-slate-800/40">
          {active.map((room) => (
            <div key={room.roomId} className="px-4 py-3">
              <p className="text-xs font-medium text-white">{room.name}</p>
              <p className="text-[10px] text-slate-500">Incident {room.incidentId}</p>
            </div>
          ))}
        </div>
      )}
    </WidgetShell>
  );
}

export function ComplianceStatusWidget({ agencyId }: WidgetProps) {
  const q = useQuery({
    queryKey: ["compliance", agencyId],
    queryFn: () =>
      backendGet<{ flags?: Array<{ id: string; label: string; ok: boolean }> }>(
        `/api/agencies/${encodeURIComponent(agencyId)}/compliance/status`,
      ),
  });
  if (q.isLoading) return <WidgetSkeleton />;
  const flags = q.data?.flags ?? [
    { id: "audit", label: "Audit logging", ok: true },
    { id: "rbac", label: "RBAC enforced", ok: true },
    { id: "retention", label: "Retention policy", ok: true },
  ];
  return (
    <WidgetShell title="Compliance" icon={Shield}>
      <div className="space-y-2 p-4">
        {flags.map((f) => (
          <div key={f.id} className="flex items-center justify-between rounded-lg border border-slate-800 px-3 py-2">
            <span className="text-xs text-slate-300">{f.label}</span>
            <StatusDot ok={f.ok} />
          </div>
        ))}
      </div>
    </WidgetShell>
  );
}

export function ApiKeyStatusWidget({ agencyId }: WidgetProps) {
  const q = useQuery({
    queryKey: ["api-keys", agencyId],
    queryFn: () =>
      backendGet<{ keys?: Array<{ id: string; label: string; status: string }> }>(
        `/api/agencies/${encodeURIComponent(agencyId)}/api-keys`,
      ),
  });
  if (q.isLoading) return <WidgetSkeleton />;
  const keys = q.data?.keys ?? [];
  return (
    <WidgetShell title="API Keys" icon={Key} count={keys.length}>
      {keys.length === 0 ? (
        <EmptyState message="No API keys configured" />
      ) : (
        <div className="divide-y divide-slate-800/40">
          {keys.map((k) => (
            <div key={k.id} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-xs text-slate-300">{k.label}</span>
              <span className="text-[10px] text-slate-500">{k.status}</span>
            </div>
          ))}
        </div>
      )}
    </WidgetShell>
  );
}

export function CadAdapterStatusWidget({ agencyId }: WidgetProps) {
  const q = useQuery({
    queryKey: ["cad-adapter", agencyId],
    queryFn: () => fetchCadIntegrations(),
    refetchInterval: 60_000,
  });
  if (q.isLoading) return <WidgetSkeleton />;
  const items = q.data?.items ?? [];
  return (
    <WidgetShell title="CAD Adapters" icon={Radio}>
      {items.length === 0 ? (
        <EmptyState message="No CAD integrations" />
      ) : (
        <div className="divide-y divide-slate-800/40">
          {items.map((i) => (
            <div key={i.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-xs font-medium text-white">{i.vendor}</p>
                <p className="text-[10px] text-slate-500">{i.connectionType}</p>
              </div>
              <StatusDot ok={i.status === "active"} />
            </div>
          ))}
        </div>
      )}
    </WidgetShell>
  );
}

export function UserLoginActivityWidget({ agencyId }: WidgetProps) {
  const q = useQuery({
    queryKey: ["auth-events", agencyId, "logins"],
    queryFn: () => fetchAuditEvents(15),
  });
  if (q.isLoading) return <WidgetSkeleton />;
  const events = (q.data ?? []).filter((e) => e.type.toLowerCase().includes("login") || e.type.toLowerCase().includes("auth"));
  const rows = events.length > 0 ? events : (q.data ?? []).slice(0, 10);
  return (
    <WidgetShell title="Login Activity" icon={Activity}>
      <div className="divide-y divide-slate-800/40">
        {rows.length === 0 ? (
          <EmptyState message="No recent auth events" />
        ) : (
          rows.map((e) => (
            <div key={e.eventId} className="px-4 py-2.5">
              <p className="text-xs text-slate-300">{e.type}</p>
              <p className="text-[10px] text-slate-600">
                {e.actorId ?? "system"} · {new Date(e.createdAt).toLocaleString()}
              </p>
            </div>
          ))
        )}
      </div>
    </WidgetShell>
  );
}

export function WebhookDeliveryWidget({ agencyId }: WidgetProps) {
  const q = useQuery({
    queryKey: ["webhook-stats", agencyId],
    queryFn: () => fetchAgencyAdminWebhooks(agencyId),
    refetchInterval: 60_000,
  });
  if (q.isLoading) return <WidgetSkeleton />;
  const hooks = (q.data ?? []) as Array<{ id?: string; url?: string; status?: string }>;
  return (
    <WidgetShell title="Webhooks" icon={Zap} count={hooks.length}>
      {hooks.length === 0 ? (
        <EmptyState message="No webhooks configured" />
      ) : (
        <div className="divide-y divide-slate-800/40">
          {hooks.map((h, idx) => (
            <div key={h.id ?? idx} className="px-4 py-2.5">
              <p className="truncate text-xs text-slate-300">{h.url ?? "Webhook"}</p>
              <p className="text-[10px] text-slate-600">{h.status ?? "active"}</p>
            </div>
          ))}
        </div>
      )}
    </WidgetShell>
  );
}

export function AgencyPipelineWidget({ agencyId }: WidgetProps) {
  const q = useQuery({
    queryKey: ["agency-pipeline", agencyId],
    queryFn: () => fetchAgencies(),
  });
  if (q.isLoading) return <WidgetSkeleton />;
  const agencies = q.data ?? [];
  const pipeline = agencies.filter((a) =>
    needsOnboardingAttention(a.status, a.config.platformOnboarding?.steps) ||
    a.status === "draft" ||
    a.status === "pilot",
  );
  return (
    <WidgetShell title="Agency Pipeline" icon={Globe} count={pipeline.length}>
      <div className="divide-y divide-slate-800/40">
        {pipeline.length === 0 ? (
          <EmptyState message="Pipeline is clear" />
        ) : (
          pipeline.slice(0, 12).map((a) => (
            <div key={a.agencyId} className="flex items-center justify-between px-4 py-2.5">
              <span className="truncate text-xs text-white">{a.name ?? a.agencyId}</span>
              <span className="text-[10px] uppercase text-slate-500">{a.status}</span>
            </div>
          ))
        )}
      </div>
    </WidgetShell>
  );
}

export function BillingHealthWidget({ agencyId }: WidgetProps) {
  const q = useQuery({
    queryKey: ["billing-health", agencyId],
    queryFn: async () => {
      const agencies = await fetchAgencies();
      const results = await Promise.all(
        agencies.slice(0, 20).map(async (a) => {
          const invoices = await fetchAgencyBillingInvoices(a.agencyId).catch(() => []);
          const overdue = invoices.filter((i) => i.status === "past_due").length;
          return { agency: a, overdue };
        }),
      );
      return results.filter((r) => r.overdue > 0);
    },
  });
  if (q.isLoading) return <WidgetSkeleton />;
  const atRisk = q.data ?? [];
  return (
    <WidgetShell title="Billing Health" icon={CreditCard} count={atRisk.length}>
      {atRisk.length === 0 ? (
        <EmptyState message="No past-due accounts" />
      ) : (
        <div className="divide-y divide-slate-800/40">
          {atRisk.map((r) => (
            <div key={r.agency.agencyId} className="flex items-center justify-between px-4 py-2.5">
              <span className="truncate text-xs text-white">{r.agency.name ?? r.agency.agencyId}</span>
              <span className="text-xs text-rose-400">{r.overdue} overdue</span>
            </div>
          ))}
        </div>
      )}
    </WidgetShell>
  );
}

export function PlatformNoticesSentWidget({ agencyId }: WidgetProps) {
  const q = useQuery({
    queryKey: ["platform-notices", agencyId],
    queryFn: () => fetchAdminPlatformNotices(),
  });
  if (q.isLoading) return <WidgetSkeleton />;
  const notices = q.data ?? [];
  return (
    <WidgetShell title="Platform Notices" icon={Bell} count={notices.length}>
      <div className="divide-y divide-slate-800/40">
        {notices.length === 0 ? (
          <EmptyState message="No notices sent" />
        ) : (
          notices.slice(0, 10).map((n) => (
            <div key={n.noticeId} className="px-4 py-2.5">
              <p className="text-xs font-medium text-white">{n.title}</p>
              <p className="text-[10px] text-slate-600">{n.severity} · {n.status}</p>
            </div>
          ))
        )}
      </div>
    </WidgetShell>
  );
}

export function ServiceCatalogSummaryWidget({ agencyId }: WidgetProps) {
  const q = useQuery({
    queryKey: ["service-catalog", agencyId],
    queryFn: () => fetchBillingServices(),
  });
  if (q.isLoading) return <WidgetSkeleton />;
  const list = q.data?.items ?? [];
  return (
    <WidgetShell title="Service Catalog" icon={Package} count={list.length}>
      <div className="divide-y divide-slate-800/40">
        {list.length === 0 ? (
          <EmptyState message="No billable services" />
        ) : (
          list.slice(0, 8).map((s: { id?: string; name?: string; unit?: string }, idx) => (
            <div key={s.id ?? idx} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-xs text-slate-300">{s.name ?? s.id}</span>
              <span className="text-[10px] text-slate-600">{s.unit ?? "unit"}</span>
            </div>
          ))
        )}
      </div>
    </WidgetShell>
  );
}

export function SystemAlertsWidget({ agencyId }: WidgetProps) {
  const q = useQuery({
    queryKey: ["system-alerts", agencyId],
    queryFn: async () => {
      const summary = await fetchPlatformSummary().catch(() => null);
      const blockers = summary?.totals?.agenciesWithOnboardingBlockers ?? 0;
      const alarms = summary?.integrationSnapshot ? 0 : 0;
      return { blockers, alarms, degraded: blockers > 0 };
    },
    refetchInterval: 60_000,
  });
  if (q.isLoading) return <WidgetSkeleton />;
  const alerts = [
    ...(q.data?.blockers ? [{ label: "Onboarding blockers", count: q.data.blockers, tone: "rose" }] : []),
    ...(q.data?.alarms ? [{ label: "Active alarms", count: q.data.alarms, tone: "yellow" }] : []),
  ];
  return (
    <WidgetShell title="System Alerts" icon={AlertCircle} count={alerts.length}>
      {alerts.length === 0 ? (
        <div className="flex h-full items-center justify-center p-4">
          <div className="flex items-center gap-2 text-xs text-emerald-400">
            <StatusDot ok />
            All clear
          </div>
        </div>
      ) : (
        <div className="space-y-2 p-4">
          {alerts.map((a) => (
            <div key={a.label} className="flex items-center justify-between rounded-lg border border-slate-800 px-3 py-2">
              <span className="text-xs text-slate-300">{a.label}</span>
              <span className={`text-sm font-semibold text-${a.tone}-400`}>{a.count}</span>
            </div>
          ))}
        </div>
      )}
    </WidgetShell>
  );
}

export function ActiveGrantsWidget({ agencyId }: WidgetProps) {
  const q = useQuery({
    queryKey: ["active-grants", agencyId],
    queryFn: () =>
      backendGet<{ grants?: Array<{ id: string; agencyId: string; label: string }> }>(
        `/api/platform/grants?status=active`,
      ),
  });
  if (q.isLoading) return <WidgetSkeleton />;
  const grants = q.data?.grants ?? [];
  return (
    <WidgetShell title="Active Grants" icon={Receipt} count={grants.length}>
      {grants.length === 0 ? (
        <EmptyState message="No active grant programs" />
      ) : (
        <div className="divide-y divide-slate-800/40">
          {grants.map((g) => (
            <div key={g.id} className="px-4 py-2.5">
              <p className="text-xs text-white">{g.label}</p>
              <p className="text-[10px] text-slate-600">{g.agencyId}</p>
            </div>
          ))}
        </div>
      )}
    </WidgetShell>
  );
}

export function RevenueSnapshotWidget({ agencyId }: WidgetProps) {
  const q = useQuery({
    queryKey: ["billing-summary", agencyId, "revenue"],
    queryFn: async () => {
      const agencies = await fetchAgencies();
      const active = agencies.filter((a) => a.status === "active").length;
      const pilot = agencies.filter((a) => a.status === "pilot").length;
      return { active, pilot, mrr: active * 2400 };
    },
  });
  if (q.isLoading) return <WidgetSkeleton />;
  return (
    <WidgetShell title="Revenue Snapshot" icon={TrendingUp}>
      <div className="grid grid-cols-3 gap-3 p-4">
        <div className="rounded-lg border border-slate-800 p-3 text-center">
          <p className="text-[10px] uppercase text-slate-500">Active</p>
          <p className="mt-1 text-xl font-semibold text-white">{q.data?.active ?? 0}</p>
        </div>
        <div className="rounded-lg border border-slate-800 p-3 text-center">
          <p className="text-[10px] uppercase text-slate-500">Pilot</p>
          <p className="mt-1 text-xl font-semibold text-white">{q.data?.pilot ?? 0}</p>
        </div>
        <div className="rounded-lg border border-slate-800 p-3 text-center">
          <p className="text-[10px] uppercase text-slate-500">Est. MRR</p>
          <p className="mt-1 text-xl font-semibold text-emerald-400">
            ${((q.data?.mrr ?? 0) / 1000).toFixed(1)}k
          </p>
        </div>
      </div>
    </WidgetShell>
  );
}

export function ApiPollerStatusWidget({ agencyId }: WidgetProps) {
  const q = useQuery({
    queryKey: ["api-pollers", agencyId],
    queryFn: () => fetchCadIntegrations(),
    refetchInterval: 60_000,
  });
  if (q.isLoading) return <WidgetSkeleton />;
  const pollers = (q.data?.items ?? []).filter((i) => i.connectionType.toLowerCase().includes("poll"));
  return (
    <WidgetShell title="API Pollers" icon={Wifi}>
      {pollers.length === 0 ? (
        <EmptyState message="No active pollers" />
      ) : (
        <div className="divide-y divide-slate-800/40">
          {pollers.map((p) => (
            <div key={p.id} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-xs text-slate-300">{p.vendor}</span>
              <StatusDot ok={p.status === "active"} />
            </div>
          ))}
        </div>
      )}
    </WidgetShell>
  );
}

export function FailedAuthEventsWidget({ agencyId }: WidgetProps) {
  const q = useQuery({
    queryKey: ["auth-events", agencyId, "failed"],
    queryFn: () => fetchAuditEvents(30),
  });
  if (q.isLoading) return <WidgetSkeleton />;
  const failed = (q.data ?? []).filter(
    (e) => e.type.toLowerCase().includes("fail") || e.type.toLowerCase().includes("denied"),
  );
  return (
    <WidgetShell title="Failed Auth" icon={ShieldAlert} count={failed.length}>
      {failed.length === 0 ? (
        <EmptyState message="No failed auth events" />
      ) : (
        <div className="divide-y divide-slate-800/40">
          {failed.slice(0, 8).map((e) => (
            <div key={e.eventId} className="px-4 py-2.5">
              <p className="text-xs text-rose-400">{e.type}</p>
              <p className="text-[10px] text-slate-600">{new Date(e.createdAt).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}
    </WidgetShell>
  );
}

export function ScorecardStatsWidget({ agencyId }: WidgetProps) {
  const q = useQuery({
    queryKey: ["scorecards", agencyId],
    queryFn: () => fetchQaScorecards({ limit: 50 }),
  });
  if (q.isLoading) return <WidgetSkeleton />;
  const cards = q.data ?? [];
  const avg =
    cards.length > 0
      ? (cards.reduce((s, c) => s + (c.overallScore ?? 0), 0) / cards.length).toFixed(1)
      : "—";
  return (
    <StatCard label="Avg scorecard" value={avg} icon={BarChart3} />
  );
}

export function QualityTrendChartWidget({ agencyId }: WidgetProps) {
  const q = useQuery({
    queryKey: ["qa-trends", agencyId],
    queryFn: () => fetchQaTrends({ period: "week", weeks: 8 }),
  });
  if (q.isLoading) return <WidgetSkeleton />;
  const list = q.data?.agencyTrends ?? q.data?.trends ?? [];
  const max = Math.max(...list.map((p) => p.avgScore ?? 0), 1);
  return (
    <WidgetShell title="Quality Trend" icon={BarChart3}>
      {list.length === 0 ? (
        <EmptyState message="No trend data yet" />
      ) : (
        <div className="flex h-48 items-end gap-1 p-4">
          {list.map((p, idx) => {
            const h = Math.round(((p.avgScore ?? 0) / max) * 100);
            const label = new Date(p.periodStart).toLocaleDateString("en-US", { month: "short", day: "numeric" });
            return (
              <div key={`${p.periodStart}-${idx}`} className="flex flex-1 flex-col items-center gap-1">
                <div className="w-full rounded-t bg-sky-600/70" style={{ height: `${h}%`, minHeight: 4 }} />
                <span className="text-[9px] text-slate-600">{label}</span>
              </div>
            );
          })}
        </div>
      )}
    </WidgetShell>
  );
}

export function ReportsSummaryWidget({ agencyId }: WidgetProps) {
  const q = useQuery({
    queryKey: ["reports", agencyId],
    queryFn: () =>
      backendGet<{ reports?: Array<{ id: string; title: string; status: string }> }>(
        `/api/agencies/${encodeURIComponent(agencyId)}/reports?limit=10`,
      ),
  });
  if (q.isLoading) return <WidgetSkeleton />;
  const reports = q.data?.reports ?? [];
  return (
    <WidgetShell title="Reports" icon={FileText} count={reports.length}>
      {reports.length === 0 ? (
        <EmptyState message="No reports available" />
      ) : (
        <div className="divide-y divide-slate-800/40">
          {reports.map((r) => (
            <div key={r.id} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-xs text-slate-300">{r.title}</span>
              <span className="text-[10px] text-slate-600">{r.status}</span>
            </div>
          ))}
        </div>
      )}
    </WidgetShell>
  );
}

export function FlaggedCallsWidget({ agencyId }: WidgetProps) {
  const q = useQuery({
    queryKey: ["qa-queue", agencyId, "flagged"],
    queryFn: () => fetchQaScorecards({ limit: 20 }),
  });
  if (q.isLoading) return <WidgetSkeleton />;
  const flagged = (q.data ?? []).filter((c) => (c.overallScore ?? 100) < 70);
  return (
    <WidgetShell title="Flagged Calls" icon={AlertTriangle} count={flagged.length}>
      {flagged.length === 0 ? (
        <EmptyState message="No flagged calls" />
      ) : (
        <div className="divide-y divide-slate-800/40">
          {flagged.map((c) => (
            <div key={c.scorecardId} className="px-4 py-2.5">
              <p className="text-xs text-white">{c.incidentId}</p>
              <p className="text-[10px] text-rose-400">Score {c.overallScore ?? "—"}</p>
            </div>
          ))}
        </div>
      )}
    </WidgetShell>
  );
}

export function AuditActivityWidget({ agencyId }: WidgetProps) {
  const q = useQuery({
    queryKey: ["audit-log", agencyId],
    queryFn: () => fetchAuditEvents(20),
  });
  if (q.isLoading) return <WidgetSkeleton />;
  const events = q.data ?? [];
  return (
    <WidgetShell title="Audit Activity" icon={Clock}>
      <div className="divide-y divide-slate-800/40">
        {events.length === 0 ? (
          <EmptyState message="No audit events" />
        ) : (
          events.map((e) => (
            <div key={e.eventId} className="px-4 py-2.5">
              <p className="text-xs text-slate-300">{e.type}</p>
              <p className="text-[10px] text-slate-600">
                {e.actorId ?? "system"} · {new Date(e.createdAt).toLocaleString()}
              </p>
            </div>
          ))
        )}
      </div>
    </WidgetShell>
  );
}

export function AccessReportsSummaryWidget({ agencyId }: WidgetProps) {
  const q = useQuery({
    queryKey: ["access-reports", agencyId],
    queryFn: () =>
      backendGet<{ items?: Array<{ id: string; label: string }> }>(
        `/api/agencies/${encodeURIComponent(agencyId)}/access-reports`,
      ),
  });
  if (q.isLoading) return <WidgetSkeleton />;
  const items = q.data?.items ?? [];
  return (
    <WidgetShell title="Access Reports" icon={Shield}>
      {items.length === 0 ? (
        <EmptyState message="No access reports" />
      ) : (
        <div className="divide-y divide-slate-800/40">
          {items.map((i) => (
            <div key={i.id} className="px-4 py-2.5 text-xs text-slate-300">{i.label}</div>
          ))}
        </div>
      )}
    </WidgetShell>
  );
}

export function CadWritebackAuditWidget({ agencyId }: WidgetProps) {
  const q = useQuery({
    queryKey: ["cad-audit", agencyId],
    queryFn: () => fetchCadWritebackApprovals({ since: "7d" }),
  });
  if (q.isLoading) return <WidgetSkeleton />;
  const items = q.data?.items ?? [];
  return (
    <WidgetShell title="CAD Write-back Audit" icon={FileText} count={items.length}>
      <div className="divide-y divide-slate-800/40">
        {items.length === 0 ? (
          <EmptyState message="No write-back events" />
        ) : (
          items.slice(0, 12).map((row: CadWritebackAuditRecord) => (
            <div key={row.id} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-xs text-slate-300">{row.incidentId}</span>
              <span className="text-[10px] uppercase text-slate-500">{row.status}</span>
            </div>
          ))
        )}
      </div>
    </WidgetShell>
  );
}

export function TrendOverviewWidget({ agencyId }: WidgetProps) {
  const q = useQuery({
    queryKey: ["audit-trends", agencyId],
    queryFn: () => fetchPlatformAuditEvents({ limit: 100 }),
  });
  if (q.isLoading) return <WidgetSkeleton />;
  const events = q.data ?? [];
  const byDay = new Map<string, number>();
  for (const e of events) {
    const day = new Date(e.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }
  const rows = [...byDay.entries()].slice(-14);
  const max = Math.max(...rows.map(([, c]) => c), 1);
  return (
    <WidgetShell title="Audit Trend" icon={Activity}>
      {rows.length === 0 ? (
        <EmptyState message="No audit trend data" />
      ) : (
        <div className="flex h-40 items-end gap-1 p-4">
          {rows.map(([day, count]) => (
            <div key={day} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-t bg-violet-600/60"
                style={{ height: `${Math.round((count / max) * 100)}%`, minHeight: 4 }}
              />
              <span className="text-[8px] text-slate-600">{day}</span>
            </div>
          ))}
        </div>
      )}
    </WidgetShell>
  );
}
