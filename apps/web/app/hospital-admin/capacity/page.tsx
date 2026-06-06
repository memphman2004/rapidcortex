import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { HospitalCapacityWorkspace } from "@/components/hospital-routing/hospital-capacity-workspace";

export default async function HospitalAdminCapacityPage() {
  const user = await getDashboardSessionUser();
  if (!user) return null;
  return <HospitalCapacityWorkspace user={user} />;
}
