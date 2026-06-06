import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";

export const metadata = {
  title: "Infrastructure & platform health",
  robots: { index: false, follow: false },
};

function DashboardCard({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-xl border border-slate-700/60 bg-slate-900/60 p-5 transition-colors hover:border-sky-700/40 hover:bg-slate-900"
    >
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      <p className="mt-2 text-xs text-slate-400">{description}</p>
    </Link>
  );
}

export default async function RcInfrastructurePage() {
  await requireRole(["rcitadmin", "rcsuperadmin"]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Infrastructure & platform health</h1>
        <p className="mt-1 text-sm text-slate-400">
          RC Internal IT — platform diagnostics, integration monitoring, and technical operations.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <DashboardCard
          title="Platform health"
          description="Lambda, DynamoDB, and API health across all tenants."
          href="/rc-admin/system-health"
        />
        <DashboardCard
          title="Integration status"
          description="CAD integration connections across all agencies."
          href="/rc-admin/api-clients"
        />
        <DashboardCard
          title="Tenant provisioning"
          description="Agency provisioning and deprovisioning management."
          href="/rc-admin/agencies"
        />
        <DashboardCard
          title="Per-user feature access"
          description="Grant feature flags, permissions, and dashboard access to individual users."
          href="/rc-admin/access"
        />
        <DashboardCard
          title="API usage"
          description="RC Lite call meters and quota monitoring (no revenue totals)."
          href="/rc-admin/usage"
        />
        <DashboardCard
          title="Audit log"
          description="Cross-tenant audit trail for compliance support."
          href="/rc-admin/dashboard"
        />
        <DashboardCard
          title="Operations hub"
          description="Platform owner operations (rcsuperadmin only)."
          href="/rc-admin/operations"
        />
      </div>
    </div>
  );
}
