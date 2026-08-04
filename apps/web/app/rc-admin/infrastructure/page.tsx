import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";
import { RcAdminConsoleHome } from "@/components/rc-admin/rc-admin-console-home";
import { dashboardDisplayName } from "@/lib/dashboards/dashboard-display-name";

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
      className="block rounded-xl border border-violet-900/40 bg-[#0b0b17]/60 p-5 transition-colors hover:border-violet-600/40 hover:bg-[#0b0b17]"
    >
      <h2 className="text-sm font-semibold text-[#e4dff5]">{title}</h2>
      <p className="mt-2 text-xs text-[#5a4d7a]">{description}</p>
    </Link>
  );
}

export default async function RcInfrastructurePage() {
  const user = await requireRole(["rcadmin", "rcitadmin", "rcsuperadmin"]);
  const isItHome = user.role === "rcitadmin";

  if (isItHome) {
    const displayName = user.displayName?.trim() || dashboardDisplayName(user);
    return (
      <RcAdminConsoleHome
        agencyId={user.agencyId}
        displayName={displayName}
        userEmail={user.email}
        userRole={user.role}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[#e4dff5]">
          Infrastructure &amp; platform health
        </h1>
        <p className="mt-1 text-sm text-[#5a4d7a]">
          Platform diagnostics, integration monitoring, and stack health across all tenants.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <DashboardCard
          title="System health"
          description="Lambda, DynamoDB, ECS, and API health across all stacks."
          href="/rc-admin/system-health"
        />
        <DashboardCard
          title="Integrations"
          description="CAD, Ring™, Nest™, Bedrock, and third-party connections per tenant."
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
