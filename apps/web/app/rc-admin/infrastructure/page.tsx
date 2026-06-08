import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";
import { RcItAdminInfrastructureHome } from "@/components/dashboards/rc-it-admin-infrastructure-home";

export const metadata = {
  title: "Infrastructure overview",
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
  const user = await requireRole(["rcitadmin", "rcsuperadmin"]);
  const isItHome = user.role === "rcitadmin";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">
          {isItHome ? "Infrastructure overview" : "Infrastructure & platform health"}
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          {isItHome
            ? "RC Internal IT — system health, integrations, CAD adapters, and cross-tenant technical support."
            : "Platform diagnostics, integration monitoring, and stack health across all tenants."}
        </p>
      </div>

      {isItHome ? <RcItAdminInfrastructureHome /> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <DashboardCard
          title="System health"
          description="Lambda, DynamoDB, ECS, and API health across all stacks."
          href="/rc-admin/system-health"
        />
        <DashboardCard
          title="Integrations"
          description="CAD, Ring, Bedrock, and third-party connections per tenant."
          href="/rc-admin/integrations"
        />
        <DashboardCard
          title="CAD administration"
          description="Adapter config, webhooks, pollers, and writeback audit."
          href="/rc-admin/integrations"
        />
        <DashboardCard
          title="Tenant provisioning"
          description="Agency onboarding status and blocked-step remediation."
          href="/rc-admin/onboarding"
        />
        <DashboardCard
          title="Users"
          description="Cross-tenant technical user support — password, MFA, unlock."
          href="/rc-admin/users"
        />
        <DashboardCard
          title="Audit log"
          description="Cross-tenant configuration and security events."
          href="/rc-admin/audit"
        />
        <DashboardCard
          title="Security"
          description="Auth failures, MFA policy, and perimeter posture."
          href="/rc-admin/security"
        />
        <DashboardCard
          title="Location QR Codes"
          description="Venue and campus QR setup during agency onboarding."
          href="/rc-admin/location-qr-codes"
        />
        {user.role === "rcsuperadmin" ? (
          <DashboardCard
            title="Platform settings"
            description="Immutable platform configuration (superadmin only)."
            href="/rc-admin/operations"
          />
        ) : null}
      </div>
    </div>
  );
}
