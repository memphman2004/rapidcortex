import { redirect } from "next/navigation";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import {
  canAccessHospitalAdminPortal,
  canUpdateHospitalCapacity,
} from "@/lib/hospital/hospital-access";
import { HospitalCapacityClient } from "./_components/HospitalCapacityClient";

export default async function HospitalAdminCapacityPage() {
  const user = await getDashboardSessionUser();
  if (!user) redirect("/login");
  if (!canAccessHospitalAdminPortal(user)) redirect("/auth/signout");

  return (
    <HospitalCapacityClient
      agencyId={user.agencyId}
      role={user.role}
      canEdit={canUpdateHospitalCapacity(user)}
    />
  );
}
