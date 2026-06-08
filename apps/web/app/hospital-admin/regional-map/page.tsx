import { redirect } from "next/navigation";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { canAccessHospitalAdminPortal } from "@/lib/hospital/hospital-access";
import { HospitalRegionalMapClient } from "./_components/HospitalRegionalMapClient";

export default async function HospitalRegionalMapPage() {
  const user = await getDashboardSessionUser();
  if (!user) redirect("/login");
  if (!canAccessHospitalAdminPortal(user)) redirect("/auth/signout");

  return <HospitalRegionalMapClient agencyId={user.agencyId} />;
}
