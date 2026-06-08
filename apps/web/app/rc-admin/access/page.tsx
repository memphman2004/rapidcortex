import { requireSuperAdmin } from "@/lib/auth/require-role";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { AccessOverridesManager } from "@/components/agency-admin/access-overrides-manager";

export const metadata = {
  title: "Feature flags",
  robots: { index: false, follow: false },
};

/** System-wide feature flags and per-user grants (rcsuperadmin only). */
export default async function RcAdminFeatureAccessPage() {
  await requireSuperAdmin();
  const user = await getDashboardSessionUser();
  if (!user) return null;
  return <AccessOverridesManager initialUser={user} />;
}
