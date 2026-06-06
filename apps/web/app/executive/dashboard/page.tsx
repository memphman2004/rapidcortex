import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { DashboardPageContent } from "@/components/dashboards/dashboard-page-content";

export default async function ExecutiveDashboardPage() {
  const user = await getDashboardSessionUser();
  if (!user) return null;
  return <DashboardPageContent prefix="executive" user={user} />;
}
