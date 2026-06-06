import { RoleDashboardLayout } from "@/components/dashboards/role-dashboard-layout";

export default function QaLayout({ children }: { children: React.ReactNode }) {
  return <RoleDashboardLayout prefix="qa">{children}</RoleDashboardLayout>;
}
