import type { UserContext } from "rapid-cortex-shared/types";
import type { DashboardPrefix } from "@/lib/dashboards/dashboard-access";
import { getRoleDashboardIdentity } from "@/lib/dashboards/role-dashboard-design";
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

export async function DashboardPageContent({
  prefix,
  user,
}: {
  prefix: DashboardPrefix;
  user: UserContext;
}) {
  const data = getDashboardSummaryForUser(prefix, user);
  const identity = getRoleDashboardIdentity(prefix, user.role);
  const isRcAdminHome = prefix === "rc-admin";

  return (
    <div className="space-y-8">
      <section id="overview" className="scroll-mt-24 space-y-2">
        <h1 className="text-xl font-semibold text-white">{identity.identityTitle}</h1>
        <p className="max-w-3xl text-sm text-slate-400">
          {isRcAdminHome ? (
            <>
              Live platform metrics from DynamoDB, Cognito, and deployment integration checks. Agency
              identifier:{" "}
              <span className="font-mono text-slate-300">{data.agencyId ?? "all tenants"}</span>
            </>
          ) : (
            <>
              Preview metrics scoped to your role. Agency identifier on payload:{" "}
              <span className="font-mono text-slate-300">{data.agencyId ?? "all tenants"}</span>
            </>
          )}
        </p>
        <ul className="list-inside list-disc text-xs text-slate-500">
          {data.complianceNotes.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <DashboardLiveDataHint feature={prefix === "supervisor" ? "sla" : undefined} />
        <DashboardIntegrationHealth prefix={prefix} user={user} />
      </section>

      {prefix === "executive" ? (
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

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {isRcAdminHome ? (
          <RcAdminDashboardMetrics />
        ) : (
          data.stats.map((s) => (
            <StatCard key={s.id} label={s.label} value={s.value} hint={s.hint} />
          ))
        )}
      </section>

      {isRcAdminHome ? <RcAdminDashboardAlerts /> : null}

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          {prefix === "supervisor" ? <SlaSupervisorPanel /> : null}
          {prefix === "supervisor" ? <ActiveCallsSupervisorPanel /> : null}
          {!isRcAdminHome ? <IncidentTable rows={data.incidents} /> : null}
          {isRcAdminHome ? <RcAdminDashboardActivity /> : <ActivityFeed items={data.activities} />}
          {prefix === "rc-admin" ? <PlatformNoticeTargetPanel /> : null}
        </div>
        <div className="space-y-4">
          {!isRcAdminHome ? <UsageChartPlaceholder title="Usage & load" /> : null}
          {!isRcAdminHome && data.securityAlerts.length > 0 ? (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-white">Security & risk</h2>
              {data.securityAlerts.map((a) => (
                <SecurityAlertCard key={a.id} alert={a} />
              ))}
            </div>
          ) : null}
          {!isRcAdminHome && data.reports.length > 0 ? (
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
