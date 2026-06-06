import { DashboardCard } from "@/components/ui/dashboard-card";
import { requireRole } from "@/lib/auth/require-role";

export default async function AnalystDashboardPage() {
  await requireRole(["analyst", "supervisor", "agencyadmin", "rcsuperadmin"]);

  return (
    <div className="mx-auto w-full max-w-[var(--rc-content-max)] space-y-6 px-4 py-4 lg:px-6 lg:py-5 2xl:px-8">
      <section className="space-y-1">
        <h1 className="text-xl font-semibold text-white">Analytics</h1>
        <p className="text-sm text-slate-400">
          Read-only access to incident data, call volumes, response times, and quality metrics for
          your agency.
        </p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <DashboardCard
          title="Call Volume"
          description="Daily, weekly, and monthly call volume trends."
          href="analytics/call-volume"
          status="active"
        />
        <DashboardCard
          title="Response Times"
          description="Answer and dispatch time analytics by priority."
          href="analytics/response-times"
          status="active"
        />
        <DashboardCard
          title="Incident Summary"
          description="Incident type breakdown and geographic distribution."
          href="analytics/incidents"
          status="active"
        />
        <DashboardCard
          title="QA Scores"
          description="Agency-wide quality score trends and dispatcher performance."
          href="analytics/qa"
          status="active"
        />
        <DashboardCard
          title="Translation Usage"
          description="Language distribution and translation request volume."
          href="analytics/translation"
          status="active"
        />
        <DashboardCard
          title="SLA Compliance"
          description="SLA adherence rates by priority and shift."
          href="analytics/sla"
          status="active"
        />
      </div>
    </div>
  );
}
