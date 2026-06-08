import { redirect } from "next/navigation";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { canAccessHospitalAdminPortal } from "@/lib/hospital/hospital-access";
import { HospitalAdminLayout } from "./_components/HospitalAdminLayout";

export default async function HospitalAdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getDashboardSessionUser();
  if (!user) redirect("/login");
  if (!canAccessHospitalAdminPortal(user)) redirect("/auth/signout");

  return <HospitalAdminLayout role={user.role}>{children}</HospitalAdminLayout>;
}
