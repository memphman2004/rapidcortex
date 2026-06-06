import { DispatchShell } from "@/components/dispatch/dispatch-shell";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";

export default async function DispatchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getDashboardSessionUser();
  return <DispatchShell user={user}>{children}</DispatchShell>;
}
