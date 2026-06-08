import { HospitalDashboardClient } from "./_components/HospitalDashboardClient";
import { dashboardDisplayName } from "@/lib/dashboards/dashboard-display-name";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";

export default async function HospitalAdminDashboardPage() {
  const user = await getDashboardSessionUser();
  if (!user) return null;

  return (
    <HospitalDashboardClient
      agencyId={user.agencyId}
      role={user.role}
      displayName={dashboardDisplayName(user)}
    />
  );
}
