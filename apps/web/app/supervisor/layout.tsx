import { RoleDashboardLayout } from "@/components/dashboards/role-dashboard-layout";

export default function SupervisorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RoleDashboardLayout prefix="supervisor">{children}</RoleDashboardLayout>;
}
