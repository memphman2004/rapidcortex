import { DashboardCard } from "@/components/ui/dashboard-card";
import { requireRole } from "@/lib/auth/require-role";

export default async function AuditorDashboardPage() {
  await requireRole(["auditor", "agencyadmin", "agencyit", "rcsuperadmin"]);

  return (
    <div className="mx-auto w-full max-w-[var(--rc-content-max)] space-y-6 px-4 py-4 lg:px-6 lg:py-5 2xl:px-8">
      <section className="space-y-1">
        <h1 className="text-xl font-semibold text-white">Audit & Compliance</h1>
        <p className="text-sm text-slate-400">
          Read-only access to audit logs, incident records, and compliance reports. All access is
          logged per CJIS policy.
        </p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <DashboardCard
          title="Audit Log"
          description="Full chronological audit trail of all system actions."
          href="audit/log"
          status="active"
        />
        <DashboardCard
          title="Incident Records"
          description="Read-only incident history with full detail view."
          href="audit/incidents"
          status="active"
        />
        <DashboardCard
          title="User Activity"
          description="Login history and action log by user."
          href="audit/user-activity"
          status="active"
        />
        <DashboardCard
          title="Data Retention"
          description="View retention policy status and scheduled deletions."
          href="audit/retention"
          status="active"
        />
        <DashboardCard
          title="Compliance Export"
          description="Export records for CJIS, accreditation, or legal review."
          href="audit/export"
          status="active"
        />
        <DashboardCard
          title="Access Reports"
          description="Who accessed what data and when."
          href="audit/access"
          status="active"
        />
      </div>
    </div>
  );
}
