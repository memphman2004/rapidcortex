import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { DashboardPageContent } from "@/components/dashboards/dashboard-page-content";

export default async function SupervisorDashboardPage() {
  const user = await getDashboardSessionUser();
  if (!user) return null;
  return <DashboardPageContent prefix="supervisor" user={user} />;
}
