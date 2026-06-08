import { redirect } from "next/navigation";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import {
  canAccessHospitalAdminPortal,
  canEditRoutingConfig,
} from "@/lib/hospital/hospital-access";
import { HospitalRoutingClient } from "./_components/HospitalRoutingClient";

export default async function HospitalRoutingPage() {
  const user = await getDashboardSessionUser();
  if (!user) redirect("/login");
  if (!canAccessHospitalAdminPortal(user)) redirect("/auth/signout");

  return (
    <HospitalRoutingClient
      agencyId={user.agencyId}
      canEdit={canEditRoutingConfig(user)}
    />
  );
}
