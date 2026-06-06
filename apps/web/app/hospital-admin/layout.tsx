import { RoleDashboardLayout } from "@/components/dashboards/role-dashboard-layout";

export default function HospitalAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RoleDashboardLayout prefix="hospital-admin">{children}</RoleDashboardLayout>;
}
