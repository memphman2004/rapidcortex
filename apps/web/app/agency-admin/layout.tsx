import { RoleDashboardLayout } from "@/components/dashboards/role-dashboard-layout";

export default function AgencyAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RoleDashboardLayout prefix="agency-admin">{children}</RoleDashboardLayout>;
}
