import { redirect } from "next/navigation";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import {
  canAccessHospitalAdminPortal,
  canExportHospitalAnalytics,
} from "@/lib/hospital/hospital-access";
import { HospitalAnalyticsClient } from "./_components/HospitalAnalyticsClient";

export default async function HospitalAnalyticsPage() {
  const user = await getDashboardSessionUser();
  if (!user) redirect("/login");
  if (!canAccessHospitalAdminPortal(user)) redirect("/auth/signout");

  return (
    <HospitalAnalyticsClient
      agencyId={user.agencyId}
      canExport={canExportHospitalAnalytics(user)}
    />
  );
}
