import { requireSuperAdmin } from "@/lib/auth/require-role";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { AccessOverridesManager } from "@/components/agency-admin/access-overrides-manager";

export const metadata = {
  title: "Access grants",
  robots: { index: false, follow: false },
};

/** Platform-wide temporary access grants (rcsuperadmin only). */
export default async function RcAdminGrantsPage() {
  await requireSuperAdmin();
  const user = await getDashboardSessionUser();
  if (!user) return null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-white">Access grants</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Issue, review, and revoke temporary role or permission overrides across agencies. All
          changes are audited.
        </p>
      </div>
      <AccessOverridesManager initialUser={user} />
    </div>
  );
}
