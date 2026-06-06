import { requireRole } from "@/lib/auth/require-role";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { AccessOverridesManager } from "@/components/agency-admin/access-overrides-manager";

export const metadata = {
  title: "Feature access",
  robots: { index: false, follow: false },
};

/** Per-user feature, permission, and dashboard grants (cross-tenant for platform operators). */
export default async function RcAdminFeatureAccessPage() {
  await requireRole(["rcsuperadmin", "rcadmin", "rcitadmin"]);
  const user = await getDashboardSessionUser();
  if (!user) return null;
  return <AccessOverridesManager initialUser={user} />;
}
