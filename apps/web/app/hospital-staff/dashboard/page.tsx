import { HospitalDashboardHome } from "@/components/dashboards/DashboardHomeRenderer";
import { dashboardDisplayName } from "@/lib/dashboards/dashboard-display-name";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";

export default async function HospitalStaffDashboardPage() {
  const user = await getDashboardSessionUser();
  if (!user) return null;
  return (
    <HospitalDashboardHome
      role={user.role}
      agencyId={user.agencyId}
      displayName={dashboardDisplayName(user)}
    />
  );
}
