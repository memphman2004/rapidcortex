import { RoleDashboardLayout } from "@/components/dashboards/role-dashboard-layout";

export default function RcAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RoleDashboardLayout prefix="rc-admin">{children}</RoleDashboardLayout>;
}
