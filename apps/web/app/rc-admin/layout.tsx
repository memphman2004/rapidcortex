import { RoleDashboardLayout } from "@/components/dashboards/role-dashboard-layout";

export const dynamic = "force-dynamic";

export default function RcAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RoleDashboardLayout prefix="rc-admin">{children}</RoleDashboardLayout>;
}
