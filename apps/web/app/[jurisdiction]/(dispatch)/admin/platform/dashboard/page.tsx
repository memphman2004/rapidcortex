"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertOctagon,
  Building2,
  Radio,
  Server,
  Sparkles,
  UserCheck2,
  Users,
} from "lucide-react";
import { useMemo } from "react";
import { AgencyStatusCard } from "@/components/platform/agency-status-card";
import { ProviderHealthCard } from "@/components/platform/provider-health-card";
import { QuickActionPanel, type QuickAction } from "@/components/platform/quick-action-panel";
import { SummaryStatCard } from "@/components/platform/summary-stat-card";
import type { SupportAlert } from "@/components/platform/support-alert-list";
import { SupportAlertList } from "@/components/platform/support-alert-list";
import {
  fetchAgencies,
  fetchApiHealth,
  fetchPlatformAuditEvents,
  fetchPlatformSummary,
} from "@/lib/api";
import { countOnboardingProgress, needsOnboardingAttention } from "@/lib/platform-onboarding-helpers";
import { useJurisdictionLink } from "@/lib/jurisdiction-context";
import { formatAgencyType, resolveAgencyVerticalFromTenant } from "@/lib/vertical";

function healthFromPilotReadiness(r: {
  multilingualIssueCount: number;
  languageSessionsConfigured: boolean;
}): "ok" | "warn" | "err" {
  if (r.multilingualIssueCount > 0) return "err";
  if (!r.languageSessionsConfigured) return "warn";
  return "ok";
}

export default function PlatformDashboardPage() {
  const to = useJurisdictionLink();
  const summaryQ = useQuery({ queryKey: ["platform", "summary"], queryFn: fetchPlatformSummary });
  const healthQ = useQuery({ queryKey: ["api", "health"], queryFn: fetchApiHealth });
  const activityQ = useQuery({
    queryKey: ["platform", "audit", "recent"],
    queryFn: () => fetchPlatformAuditEvents({ limit: 40, perAgencyCap: 20 }),
  });
  const agenciesQ = useQuery({ queryKey: ["agencies", "all"], queryFn: fetchAgencies });

  const s = summaryQ.data;
  const pilot = s?.integrationSnapshot.pilotReadiness;

  const attentionAgencies = useMemo(() => {
    const list = agenciesQ.data ?? [];
    return list
      .filter((a) => needsOnboardingAttention(a.status, a.config.platformOnboarding?.steps))
      .slice(0, 5);
  }, [agenciesQ.data]);

  const alerts: SupportAlert[] = useMemo(() => {
    const out: SupportAlert[] = [];
    if (!s) return out;
    if (s.totals.agenciesWithOnboardingBlockers > 0) {
      out.push({
        id: "onb-block",
        title: "Onboarding blockers",
        detail: `${s.totals.agenciesWithOnboardingBlockers} tenant(s) have at least one blocked onboarding step. Review the onboarding pipeline.`,
        severity: "critical",
      });
    }
    if (s.totals.onboardingItemsNeedingAttention > 0) {
      out.push({
        id: "onb-attn",
        title: "Onboarding needs attention",
        detail: `${s.totals.onboardingItemsNeedingAttention} agencies are in draft or have incomplete checklists before go-live.`,
        severity: "warning",
      });
    }
    if (pilot && pilot.multilingualIssueCount > 0) {
      out.push({
        id: "ml",
        title: "Multilingual / STT configuration",
        detail: `Pilot readiness reports ${pilot.multilingualIssueCount} validation issue(s). Check Integrations and language pipeline configuration.`,
        severity: "warning",
      });
    }
    if (s.totals.pilotOrDraftAgencies > 0) {
      out.push({
        id: "pilot-open",
        title: "Pilot & draft programs",
        detail: `${s.totals.pilotOrDraftAgencies} agencies in pilot, draft, or pilot-type programs — verify contracts and go-live checklists.`,
        severity: "info",
      });
    }
    if (!s.hasAgencies) {
      out.push({
        id: "no-ag",
        title: "No agencies onboarded",
        detail: "Create a tenant to begin delivery.",
        severity: "info",
      });
    }
    return out;
  }, [s, pilot]);

  const quickActions: QuickAction[] = useMemo(
    () => [
      {
        href: to("/admin/platform/agencies/new"),
        label: "Create agency",
        description: "Register a new municipality tenant",
      },
      {
        href: to("/admin/platform/users"),
        label: "Create first admin",
        description: "Provision Cognito user with admin or platform role",
      },
      {
        href: to("/admin/platform/onboarding"),
        label: "Onboarding pipeline",
        description: "Checklist and status by tenant",
      },
      {
        href: to("/admin/platform/integrations"),
        label: "Review integrations",
        description: "Providers, STT, email, and video stack",
      },
      {
        href: to("/admin/platform/agencies"),
        label: "Search agency directory",
        description: "Full tenant list with sort and open actions",
      },
      {
        href: to("/admin/platform/audit"),
        label: "View audit log",
        description: "Cross-tenant security and admin events",
      },
    ],
    [to],
  );

  const opAlerts = s?.totals.agenciesWithOnboardingBlockers ?? 0;
  const providerSummary =
    pilot == null
      ? "—"
      : pilot.multilingualIssueCount > 0
        ? "Degraded: multilingual"
        : !pilot.assetsBucketConfigured
          ? "Warn: assets bucket"
          : "Nominal (sample)";

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-rose-400/90">
          Command center
        </p>
        <p className="mt-1 text-sm text-slate-400">
          Cross-tenant platform operations · generated{" "}
          {s ? (
            <span className="font-mono text-slate-500">{s.generatedAt}</span>
          ) : (
            <span className="text-slate-600">—</span>
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:gap-3">
        <SummaryStatCard
          label="Total agencies"
          value={s?.totals.agencies ?? "—"}
          icon={Building2}
          hint="All tenants in Dynamo"
        />
        <SummaryStatCard
          label="Active / pilot"
          value={s?.totals.activeAgencies ?? "—"}
          icon={Activity}
          variant="ok"
          hint="Lifecycle active or pilot"
        />
        <SummaryStatCard
          label="Users (Cognito list)"
          value={s?.totals.users ?? "—"}
          icon={Users}
          hint={
            s != null
              ? `${s.totals.activeUsers} enabled in pool sample`
              : "Pool list capped by API"
          }
        />
        <SummaryStatCard
          label="Live incidents (sample)"
          value={s?.totals.liveIncidents ?? "—"}
          icon={Radio}
          hint="Recent bucket per first 50 agencies"
        />
        <SummaryStatCard
          label="Onboarding action queue"
          value={s?.totals.onboardingItemsNeedingAttention ?? "—"}
          icon={Sparkles}
          variant={s && s.totals.onboardingItemsNeedingAttention > 0 ? "alert" : "default"}
        />
        <SummaryStatCard
          label="Ops alerts (blockers)"
          value={opAlerts}
          icon={AlertOctagon}
          variant={opAlerts > 0 ? "alert" : "ok"}
        />
        <SummaryStatCard
          label="Provider health (hint)"
          value={providerSummary}
          icon={Server}
          hint="From deployment integration snapshot"
        />
        <SummaryStatCard
          label="API probe"
          value={healthQ.data?.status ?? (healthQ.isLoading ? "…" : "—")}
          icon={UserCheck2}
          hint={
            healthQ.data?.deploymentStage
              ? `Stage ${healthQ.data.deploymentStage}`
              : "GET /api/health/upstream"
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="min-w-0">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Platform alerts
          </h2>
          <div className="mt-2">
            {summaryQ.isLoading ? (
              <p className="text-sm text-slate-500">Loading platform metrics…</p>
            ) : summaryQ.isError ? (
              <p className="text-sm text-rose-300">
                {summaryQ.error instanceof Error ? summaryQ.error.message : "Failed to load summary"}
              </p>
            ) : (
              <SupportAlertList items={alerts} />
            )}
          </div>
        </section>

        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Provider health
          </h2>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {pilot ? (
              <>
                <ProviderHealthCard
                  title="STT & translation"
                  health={healthFromPilotReadiness(pilot)}
                >
                  Issues: {pilot.multilingualIssueCount} · Primary STT: {pilot.multilingualPrimaryStt}
                </ProviderHealthCard>
                <ProviderHealthCard
                  title="AI analysis"
                  health="ok"
                >
                  {pilot.aiPrimaryProvider} (primary) · {pilot.aiSecondaryProvider} (secondary)
                </ProviderHealthCard>
                <ProviderHealthCard
                  title="Assets & media"
                  health={pilot.assetsBucketConfigured ? "ok" : "warn"}
                >
                  S3 assets bucket: {pilot.assetsBucketConfigured ? "configured" : "not reported"}
                </ProviderHealthCard>
                <ProviderHealthCard
                  title="API deployment"
                  health={
                    healthQ.data?.status === "ok" || healthQ.data?.status === "healthy"
                      ? "ok"
                      : "unknown"
                  }
                >
                  {healthQ.data?.service ?? "—"} {healthQ.data?.revision ? `· ${healthQ.data.revision}` : ""}
                </ProviderHealthCard>
              </>
            ) : (
              <p className="text-sm text-slate-500">No integration snapshot yet.</p>
            )}
          </div>
        </section>
      </div>

      {attentionAgencies.length > 0 ? (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Agencies needing attention
          </h2>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {attentionAgencies.map((a) => {
              const prog = countOnboardingProgress(a.config.platformOnboarding?.steps);
              return (
                <AgencyStatusCard
                  key={a.agencyId}
                  name={a.name}
                  agencyId={a.agencyId}
                  status={a.status}
                  href={to(`/admin/platform/agencies/${encodeURIComponent(a.agencyId)}`)}
                  sublabel={`${formatAgencyType(a.type)} · Onboarding ${prog.complete}/${prog.total} · ${a.integrationMode}`}
                  attention
                  vertical={resolveAgencyVerticalFromTenant(a)}
                />
              );
            })}
          </div>
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="min-w-0">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Recent platform activity
          </h2>
          <p className="mt-0.5 text-xs text-slate-600">Merged audit stream (newest first)</p>
          <ul className="mt-2 max-h-80 space-y-1.5 overflow-y-auto rounded-lg border border-slate-800 bg-slate-900/30 p-2">
            {activityQ.isLoading ? (
              <li className="text-sm text-slate-500">Loading events…</li>
            ) : activityQ.isError ? (
              <li className="text-sm text-rose-300">Could not load audit stream.</li>
            ) : (activityQ.data ?? []).length === 0 ? (
              <li className="text-sm text-slate-500">No events yet.</li>
            ) : (
              (activityQ.data ?? []).map((e) => (
                <li
                  key={e.eventId}
                  className="rounded border border-slate-800/60 bg-slate-950/40 px-2 py-1.5 text-xs"
                >
                  <div className="font-mono text-[10px] text-slate-500">{e.createdAt}</div>
                  <div className="text-slate-200">
                    <span className="text-slate-100">{e.type}</span>{" "}
                    <span className="text-slate-500">·</span>{" "}
                    <span className="font-mono text-slate-400">{e.agencyId}</span>
                  </div>
                  {e.actorId ? (
                    <div className="text-[10px] text-slate-500">actor {e.actorId}</div>
                  ) : null}
                </li>
              ))
            )}
          </ul>
        </section>
        <QuickActionPanel title="Quick actions" actions={quickActions} />
      </div>
    </div>
  );
}
