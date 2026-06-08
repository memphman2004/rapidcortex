import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";

export const metadata = {
  title: "System settings",
  robots: { index: false, follow: false },
};

function SettingsCard({
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
      className="block rounded-xl border border-slate-700/60 bg-slate-900/60 p-5 transition-colors hover:border-cyan-700/40 hover:bg-slate-900"
    >
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      <p className="mt-2 text-xs text-slate-400">{description}</p>
    </Link>
  );
}

export default async function RcAdminSystemSettingsPage() {
  await requireRole(["rcitadmin", "rcsuperadmin"]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">System settings</h1>
        <p className="mt-1 text-sm text-slate-400">
          Platform-wide technical configuration — integrations, onboarding templates, and per-tenant feature gates.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SettingsCard
          title="Onboarding pipeline"
          description="Tenant provisioning checklists and blocked-step remediation."
          href="/rc-admin/onboarding"
        />
        <SettingsCard
          title="Integrations"
          description="CAD adapters, webhooks, pollers, and third-party connection health."
          href="/rc-admin/integrations"
        />
        <SettingsCard
          title="Agency feature toggles"
          description="Per-tenant product flags and vertical configuration."
          href="/rc-admin/agencies"
        />
        <SettingsCard
          title="System health"
          description="Stack health, alarms, and deployment integration snapshot."
          href="/rc-admin/system-health"
        />
      </div>
    </div>
  );
}
