import { redirect } from "next/navigation";
import { isRcItAdmin, isRcSuperAdmin } from "rapid-cortex-security";
import { migrateLegacyRapidCortexRoleTokenValue } from "rapid-cortex-shared/auth/rapid-cortex-roles";
import { DashboardPageContent } from "@/components/dashboards/dashboard-page-content";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";

export const dynamic = "force-dynamic";

export default async function RcAdminDashboardPage() {
  const user = await getDashboardSessionUser();
  if (!user) {
    redirect("/login?from=/rc-admin/dashboard");
  }
  const role = migrateLegacyRapidCortexRoleTokenValue(user.role) ?? user.role;
  if (isRcItAdmin(role) && !isRcSuperAdmin(role)) {
    redirect("/rc-admin/infrastructure");
  }
  return <DashboardPageContent prefix="rc-admin" user={user} />;
}
