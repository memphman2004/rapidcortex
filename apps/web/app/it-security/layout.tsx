import { RoleDashboardLayout } from "@/components/dashboards/role-dashboard-layout";

export default function ItSecurityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RoleDashboardLayout prefix="it-security">{children}</RoleDashboardLayout>;
}
