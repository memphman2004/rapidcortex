import { HospitalHomeDashboard } from "@/components/hospital-routing/hospital-home-dashboard";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";

export default async function HospitalStaffDashboardPage() {
  const user = await getDashboardSessionUser();
  if (!user) return null;
  return <HospitalHomeDashboard user={user} variant="hospital-staff" />;
}
