"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { AgencyTenant, AuditEvent } from "rapid-cortex-shared";
import {
  fetchAdminUsers,
  fetchAgencies,
  fetchApiHealth,
  fetchPlatformAuditEvents,
  fetchPlatformSummary,
  type PlatformSummaryPayload,
} from "@/lib/api";
import {
  countOnboardingProgress,
  needsOnboardingAttention,
} from "@/lib/platform-onboarding-helpers";
import { deriveVerticalFromAgencyId, normalizeVertical } from "@/lib/vertical";
import { VerticalBadge } from "@/components/ui/VerticalBadge";
import { ActivityFeed } from "./activity-feed";
import { SecurityAlertCard } from "./security-alert-card";
import { StatCard } from "./stat-card";
import type { ActivityItem, KpiStat, SecurityAlert } from "@/lib/dashboards/mockDashboardData";

function formatRelativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return iso;
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function agencyPlanLabel(agency: AgencyTenant): string {
  const withPlan = agency as AgencyTenant & {
    monetizationPlanId?: string;
    planId?: string;
    planTier?: string;
  };
  return (
    withPlan.monetizationPlanId ??
    withPlan.planId ??
    withPlan.planTier ??
    (agency.status === "pilot" || agency.type === "pilot" ? "Pilot" : "—")
  );
}

function agencyHealthLabel(agency: AgencyTenant): { text: string; tone: "ok" | "warn" | "err" } {
  const prog = countOnboardingProgress(agency.config.platformOnboarding?.steps);
  if (prog.blocked > 0) return { text: `${prog.blocked} blocked`, tone: "err" };
  if (needsOnboardingAttention(agency.status, agency.config.platformOnboarding?.steps)) {
    return { text: "Needs attention", tone: "warn" };
  }
  if (agency.status === "suspended" || agency.status === "archived") {
    return { text: agency.status, tone: "warn" };
  }
  return { text: "OK", tone: "ok" };
}

function auditToActivity(event: AuditEvent): ActivityItem {
  return {
    id: event.eventId,
    title: event.type,
    description: `${event.agencyId}${event.actorId ? ` · ${event.actorId}` : ""}`,
    timeLabel: formatRelativeTime(event.createdAt),
    tone: event.type.toLowerCase().includes("fail") ? "warning" : "active",
  };
}

function buildStats(
  summary: PlatformSummaryPayload | undefined,
  agencies: AgencyTenant[],
  usersCount: number | undefined,
  healthStatus: string | undefined,
): KpiStat[] {
  const totals = summary?.totals;
  const activeCount = totals?.activeAgencies ?? agencies.filter((a) => a.status === "active" || a.status === "pilot").length;
  const pilotDraft =
    totals?.pilotOrDraftAgencies ??
    agencies.filter((a) => a.status === "draft" || a.status === "pilot" || a.type === "pilot").length;
  const onboardingQueue =
    totals?.onboardingItemsNeedingAttention ??
    agencies.filter((a) => needsOnboardingAttention(a.status, a.config.platformOnboarding?.steps)).length;
  const blockers =
    totals?.agenciesWithOnboardingBlockers ??
    agencies.filter((a) =>
      Object.values(a.config.platformOnboarding?.steps ?? {}).some((v) => v === "blocked"),
    ).length;

  return [
    {
      id: "agencies",
      label: "Total agencies",
      value: String(totals?.agencies ?? agencies.length),
      hint: "Tenants in DynamoDB",
    },
    {
      id: "active",
      label: "Active / pilot",
      value: String(activeCount),
      hint: "Lifecycle active or pilot",
    },
    {
      id: "users",
      label: "Users (Cognito)",
      value: totals?.users != null ? String(totals.users) : usersCount != null ? String(usersCount) : "—",
      hint:
        totals?.activeUsers != null
          ? `${totals.activeUsers} enabled in pool`
          : "Directory sample from admin API",
    },
    {
      id: "incidents",
      label: "Live incidents",
      value: totals?.liveIncidents != null ? String(totals.liveIncidents) : "—",
      hint: "Active incidents (sampled tenants)",
    },
    {
      id: "onboarding",
      label: "Onboarding queue",
      value: String(onboardingQueue),
      hint: "Draft or incomplete checklists",
    },
    {
      id: "blockers",
      label: "Onboarding blockers",
      value: String(blockers),
      hint: "Tenants with blocked steps",
    },
    {
      id: "pilot",
      label: "Pilot & draft",
      value: String(pilotDraft),
      hint: "Pre-production programs",
    },
    {
      id: "api",
      label: "API status",
      value: healthStatus ?? "—",
      hint: "Upstream health probe",
    },
  ];
}

function buildSecurityAlerts(summary: PlatformSummaryPayload | undefined): SecurityAlert[] {
  if (!summary) return [];
  const alerts: SecurityAlert[] = [];
  if (summary.totals.agenciesWithOnboardingBlockers > 0) {
    alerts.push({
      id: "onb-block",
      agencyId: "platform",
      title: "Onboarding blockers",
      severity: "critical",
      message: `${summary.totals.agenciesWithOnboardingBlockers} tenant(s) have blocked onboarding steps.`,
    });
  }
  const pilot = summary.integrationSnapshot?.pilotReadiness;
  if (pilot && pilot.multilingualIssueCount > 0) {
    alerts.push({
      id: "ml-config",
      agencyId: "platform",
      title: "Multilingual / STT configuration",
      severity: "warning",
      message: `${pilot.multilingualIssueCount} validation issue(s) in deployment integration snapshot.`,
    });
  }
  if (!summary.hasAgencies) {
    alerts.push({
      id: "no-agencies",
      agencyId: "platform",
      title: "No agencies onboarded",
      severity: "pending",
      message: "Create a tenant to begin delivery.",
    });
  }
  return alerts;
}

function useRcAdminLiveQueries() {
  const summaryQ = useQuery({
    queryKey: ["platform", "summary"],
    queryFn: fetchPlatformSummary,
    retry: false,
  });
  const agenciesQ = useQuery({ queryKey: ["agencies"], queryFn: fetchAgencies });
  const usersQ = useQuery({ queryKey: ["admin-users"], queryFn: fetchAdminUsers, retry: false });
  const healthQ = useQuery({ queryKey: ["api", "health"], queryFn: fetchApiHealth });
  const auditQ = useQuery({
    queryKey: ["platform", "audit", "dashboard"],
    queryFn: () => fetchPlatformAuditEvents({ limit: 20, perAgencyCap: 15 }),
    retry: false,
  });

  return { summaryQ, agenciesQ, usersQ, healthQ, auditQ };
}

export function RcAdminHeaderStats() {
  const { summaryQ, agenciesQ, healthQ } = useRcAdminLiveQueries();
  const agencies = agenciesQ.data ?? [];
  const summary = summaryQ.data;
  const blockers =
    summary?.totals.agenciesWithOnboardingBlockers ??
    agencies.filter((a) =>
      Object.values(a.config.platformOnboarding?.steps ?? {}).some((v) => v === "blocked"),
    ).length;
  const healthLabel = healthQ.data?.status ?? (healthQ.isLoading ? "…" : "—");

  const pills = [
    { label: "Agencies", value: String(summary?.totals.agencies ?? agencies.length) },
    { label: "API", value: healthLabel },
    { label: "Onboarding alerts", value: String(summary?.totals.onboardingItemsNeedingAttention ?? "—") },
    { label: "Blockers", value: String(blockers) },
  ];

  return (
    <>
      {pills.map(({ label, value }) => (
        <div
          key={label}
          className="rounded-md border px-3 py-1.5"
          style={{
            borderColor: "color-mix(in srgb, var(--role-accent) 35%, transparent)",
            backgroundColor: "color-mix(in srgb, var(--role-accent-dim) 45%, rgb(2 6 23))",
          }}
        >
          <p
            className="text-[10px] font-medium uppercase tracking-wide"
            style={{ color: "var(--role-text-accent)" }}
          >
            {label}
          </p>
          <p className="font-mono text-sm font-semibold text-white">{value}</p>
        </div>
      ))}
    </>
  );
}

export function RcAdminHomePanels() {
  const { summaryQ, agenciesQ, healthQ } = useRcAdminLiveQueries();
  const agencies = useMemo(
    () => [...(agenciesQ.data ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [agenciesQ.data],
  );
  const preview = agencies.slice(0, 8);
  const pilot = summaryQ.data?.integrationSnapshot?.pilotReadiness;

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950/70">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-4 py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Agencies</p>
          <Link
            href="/rc-admin/agencies"
            className="text-[11px] hover:opacity-90"
            style={{ color: "var(--role-accent)" }}
          >
            View all ({agencies.length}) →
          </Link>
        </div>
        {agenciesQ.isLoading ? (
          <p className="px-4 py-6 text-sm text-slate-500">Loading agencies…</p>
        ) : agenciesQ.isError ? (
          <p className="px-4 py-6 text-sm text-rose-300">
            {agenciesQ.error instanceof Error ? agenciesQ.error.message : "Could not load agencies"}
          </p>
        ) : preview.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">No agencies onboarded yet.</p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Agency</th>
                <th className="px-4 py-2 font-medium">Vertical</th>
                <th className="px-4 py-2 font-medium">Plan</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Health</th>
                <th className="px-4 py-2 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {preview.map((agency) => {
                const vertical = normalizeVertical(
                  (agency as AgencyTenant & { vertical?: string }).vertical ??
                    deriveVerticalFromAgencyId(agency.agencyId),
                );
                const health = agencyHealthLabel(agency);
                return (
                  <tr key={agency.agencyId} className="hover:bg-slate-900/40">
                    <td className="px-4 py-2">
                      <div className="font-medium text-slate-100">{agency.name}</div>
                      <div className="font-mono text-[10px] text-slate-500">{agency.agencyId}</div>
                    </td>
                    <td className="px-4 py-2">
                      <VerticalBadge vertical={vertical} size="xs" />
                    </td>
                    <td className="px-4 py-2 capitalize">{agencyPlanLabel(agency)}</td>
                    <td className="px-4 py-2">{agency.status}</td>
                    <td
                      className={`px-4 py-2 font-medium ${
                        health.tone === "ok"
                          ? "text-emerald-300"
                          : health.tone === "warn"
                            ? "text-amber-300"
                            : "text-rose-300"
                      }`}
                    >
                      {health.text}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Link
                        href={`/rc-admin/agencies/${encodeURIComponent(agency.agencyId)}/features`}
                        className="hover:opacity-90"
                        style={{ color: "var(--role-accent)" }}
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
          <p className="text-xs font-semibold text-slate-400">Integration snapshot</p>
          {summaryQ.isLoading ? (
            <p className="mt-2 text-[11px] text-slate-500">Loading…</p>
          ) : pilot ? (
            <ul className="mt-2 space-y-1 text-[11px] text-slate-400">
              <li>STT issues: {pilot.multilingualIssueCount}</li>
              <li>Primary STT: {pilot.multilingualPrimaryStt}</li>
              <li>AI: {pilot.aiPrimaryProvider}</li>
              <li>Assets bucket: {pilot.assetsBucketConfigured ? "configured" : "not reported"}</li>
            </ul>
          ) : (
            <p className="mt-2 text-[11px] text-slate-500">No integration snapshot available.</p>
          )}
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
          <p className="text-xs font-semibold text-slate-400">API deployment</p>
          <p className="mt-2 text-[11px] text-slate-400">
            {healthQ.data
              ? `${healthQ.data.service}${healthQ.data.deploymentStage ? ` · ${healthQ.data.deploymentStage}` : ""} · ${healthQ.data.status}`
              : healthQ.isLoading
                ? "Checking upstream health…"
                : "Health probe unavailable"}
          </p>
          {summaryQ.data?.generatedAt ? (
            <p className="mt-2 font-mono text-[10px] text-slate-600">
              Metrics generated {summaryQ.data.generatedAt}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function RcAdminDashboardMetrics() {
  const { summaryQ, agenciesQ, usersQ, healthQ } = useRcAdminLiveQueries();
  const stats = buildStats(
    summaryQ.data,
    agenciesQ.data ?? [],
    usersQ.data?.length,
    healthQ.data?.status,
  );

  if (agenciesQ.isLoading && !agenciesQ.data) {
    return <p className="text-sm text-slate-500">Loading platform metrics…</p>;
  }

  if (agenciesQ.isError) {
    return (
      <p className="text-sm text-rose-300">
        {agenciesQ.error instanceof Error ? agenciesQ.error.message : "Failed to load platform metrics"}
      </p>
    );
  }

  return (
    <>
      {stats.map((s) => (
        <StatCard key={s.id} label={s.label} value={s.value} hint={s.hint} />
      ))}
    </>
  );
}

export function RcAdminDashboardActivity() {
  const { auditQ } = useRcAdminLiveQueries();
  const items = useMemo(
    () => (auditQ.data ?? []).slice(0, 12).map(auditToActivity),
    [auditQ.data],
  );

  if (auditQ.isLoading) {
    return <p className="text-sm text-slate-500">Loading platform activity…</p>;
  }
  if (auditQ.isError) {
    return (
      <p className="text-sm text-amber-200">
        Audit stream unavailable — platform summary may require RC Super Admin role.
      </p>
    );
  }
  if (items.length === 0) {
    return <p className="text-sm text-slate-500">No platform audit events yet.</p>;
  }
  return <ActivityFeed items={items} />;
}

export function RcAdminDashboardAlerts() {
  const { summaryQ } = useRcAdminLiveQueries();
  const alerts = buildSecurityAlerts(summaryQ.data);

  if (summaryQ.isLoading) return null;
  if (alerts.length === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-white">Platform alerts</h2>
      {alerts.map((a) => (
        <SecurityAlertCard key={a.id} alert={a} />
      ))}
    </div>
  );
}
