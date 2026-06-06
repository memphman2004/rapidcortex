import { DispatcherDashboardContent } from "@/components/dashboards/dispatcher-dashboard-content";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";

export default async function DispatcherDashboardPage() {
  const user = await getDashboardSessionUser();
  if (!user) return null;
  return <DispatcherDashboardContent user={user} />;
}
