import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { DashboardPageContent } from "@/components/dashboards/dashboard-page-content";

export default async function AgencyAdminDashboardPage() {
  const user = await getDashboardSessionUser();
  if (!user) return null;
  return <DashboardPageContent prefix="agency-admin" user={user} />;
}
