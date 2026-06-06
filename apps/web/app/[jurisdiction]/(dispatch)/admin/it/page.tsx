import { DashboardCard } from "@/components/ui/dashboard-card";
import { requireRole } from "@/lib/auth/require-role";

export default async function ItAdminDashboardPage() {
  await requireRole(["agencyit", "agencyadmin", "rcsuperadmin"]);

  return (
    <div className="mx-auto w-full max-w-[var(--rc-content-max)] space-y-6 px-4 py-4 lg:px-6 lg:py-5 2xl:px-8">
      <section className="space-y-1">
        <h1 className="text-xl font-semibold text-white">IT Administration</h1>
        <p className="text-sm text-slate-400">
          Manage integrations, API keys, CAD connections, and technical configuration for your
          agency.
        </p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <DashboardCard
          title="CAD Integration"
          description="Configure and monitor your CAD system connection."
          href="admin/cad"
          status="active"
        />
        <DashboardCard
          title="API Keys"
          description="Manage RC Lite API keys and webhook endpoints."
          href="admin/integrations"
          status="active"
        />
        <DashboardCard
          title="System Health"
          description="Monitor integration status, uptime, and error rates."
          href="admin/readiness"
          status="active"
        />
        <DashboardCard
          title="Security & Compliance"
          description="MFA policy, session timeouts, CJIS compliance settings."
          href="admin/security"
          status="active"
        />
        <DashboardCard
          title="Audit Log Export"
          description="Export audit logs for compliance and CJIS review."
          href="admin/audit"
          status="active"
        />
        <DashboardCard
          title="User Directory Sync"
          description="Sync users from Active Directory or LDAP."
          href="admin/it/user-sync"
          status="coming_soon"
        />
      </div>
    </div>
  );
}
