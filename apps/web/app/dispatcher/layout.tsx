import { RoleDashboardLayout } from "@/components/dashboards/role-dashboard-layout";

export default function DispatcherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RoleDashboardLayout prefix="dispatcher">{children}</RoleDashboardLayout>;
}
