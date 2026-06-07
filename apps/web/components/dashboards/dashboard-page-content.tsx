import type { UserContext } from "rapid-cortex-shared/types";
import type { DashboardPrefix } from "@/lib/dashboards/dashboard-access";
import { getRoleDashboardIdentity } from "@/lib/dashboards/role-dashboard-design";
import {
  getRoleDashboardOverviewDescription,
  getRoleDashboardSections,
} from "@/lib/dashboards/role-dashboard-sections";
import { getDashboardSummaryForUser } from "@/lib/dashboards/get-dashboard-summary";
import { DashboardLiveDataHint } from "./dashboard-live-data-hint";
import { DashboardIntegrationHealth } from "./dashboard-integration-health";
import {
  RcAdminDashboardActivity,
  RcAdminDashboardAlerts,
  RcAdminDashboardMetrics,
} from "./rc-admin-live-dashboard";
import { SlaSupervisorPanel } from "./sla-supervisor-panel";
import { ActiveCallsSupervisorPanel } from "@/components/call-control/active-calls-supervisor-panel";
import { ReportCard } from "./report-card";
import { SecurityAlertCard } from "./security-alert-card";
import { StatCard } from "./stat-card";
import { UsageChartPlaceholder } from "./usage-chart-placeholder";
import { PlatformNoticeTargetPanel } from "./platform-notice-target-panel";
import { ActivityFeed } from "./activity-feed";
import { IncidentTable } from "@/components/dispatch/incident-table";
import {
  AgencyAdminSummaryPanel,
  ExecutiveTrendsPanel,
  ItSecurityPosturePanel,
  QaReviewQueuePanel,
} from "./role-overview-panels";

export async function DashboardPageContent({
  prefix,
  user,
}: {
  prefix: DashboardPrefix;
  user: UserContext;
}) {
  const data = getDashboardSummaryForUser(prefix, user);
  const identity = getRoleDashboardIdentity(prefix, user.role);
  const sections = getRoleDashboardSections(prefix);
  const isRcAdminHome = prefix === "rc-admin";

  return (
    <div className="space-y-8">
      <section id="overview" className="scroll-mt-24 space-y-2">
        <h1 className="text-xl font-semibold text-white">{identity.identityTitle}</h1>
        <p className="max-w-3xl text-sm text-slate-400">{identity.identitySubtitle}</p>
        <p className="max-w-3xl text-sm text-slate-500">
          {getRoleDashboardOverviewDescription(prefix, data.agencyId)}
        </p>
        {sections.integrationHealth || data.complianceNotes.length > 0 ? (
          <ul className="list-inside list-disc text-xs text-slate-500">
            {data.complianceNotes.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}
        {sections.supervisorSla ? <DashboardLiveDataHint feature="sla" /> : null}
        {sections.integrationHealth ? <DashboardIntegrationHealth prefix={prefix} user={user} /> : null}
      </section>

      {sections.executiveGrants ? (
        <>
          <section id="grants" className="scroll-mt-24 rounded-lg border border-slate-800 bg-slate-950/40 p-4">
            <h2 className="text-sm font-semibold text-white">Grant reporting</h2>
            <p className="mt-1 text-xs text-slate-400">
              Export grant-ready summaries from Reports once your agency reporting period is configured.
            </p>
          </section>
          <section id="export" className="scroll-mt-24 rounded-lg border border-slate-800 bg-slate-950/40 p-4">
            <h2 className="text-sm font-semibold text-white">Export center</h2>
            <p className="mt-1 text-xs text-slate-400">
              Bulk exports are available from Analytics and Reports in the dispatch workspace.
            </p>
          </section>
        </>
      ) : null}

      {sections.stats ? (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {isRcAdminHome ? (
            <RcAdminDashboardMetrics />
          ) : (
            data.stats.map((s) => (
              <StatCard key={s.id} label={s.label} value={s.value} hint={s.hint} />
            ))
          )}
        </section>
      ) : null}

      {isRcAdminHome ? <RcAdminDashboardAlerts /> : null}

      {sections.qaReviewQueue ? <QaReviewQueuePanel data={data} /> : null}
      {sections.agencyAdminQuickActions ? <AgencyAdminSummaryPanel /> : null}
      {sections.itSecurityPosture ? <ItSecurityPosturePanel /> : null}
      {sections.executiveTrends ? <ExecutiveTrendsPanel /> : null}

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {sections.supervisorSla ? <SlaSupervisorPanel /> : null}
          {sections.supervisorActiveCalls ? <ActiveCallsSupervisorPanel /> : null}
          {sections.liveOperationsIncidents ? (
            <IncidentTable rows={data.incidents} emptyHint="No active incidents in your queue." />
          ) : null}
          {isRcAdminHome ? (
            <RcAdminDashboardActivity />
          ) : sections.activityFeed ? (
            <ActivityFeed items={data.activities} />
          ) : null}
          {sections.platformNotices ? <PlatformNoticeTargetPanel /> : null}
        </div>
        <div className="space-y-4">
          {sections.usageChart ? <UsageChartPlaceholder title="Usage & load" /> : null}
          {sections.securityAlerts && data.securityAlerts.length > 0 ? (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-white">Security & risk</h2>
              {data.securityAlerts.map((a) => (
                <SecurityAlertCard key={a.id} alert={a} />
              ))}
            </div>
          ) : null}
          {sections.reports && data.reports.length > 0 ? (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-white">Reports</h2>
              {data.reports.map((r) => (
                <ReportCard key={r.id} report={r} />
              ))}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
