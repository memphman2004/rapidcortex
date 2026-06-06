import { RoleDashboardLayout } from "@/components/dashboards/role-dashboard-layout";

export default function ExecutiveLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RoleDashboardLayout prefix="executive">{children}</RoleDashboardLayout>;
}
