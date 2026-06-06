import { RoleDashboardLayout } from "@/components/dashboards/role-dashboard-layout";

export default function HospitalStaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RoleDashboardLayout prefix="hospital-staff">{children}</RoleDashboardLayout>;
}
