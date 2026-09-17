import { redirect } from "next/navigation";
import { dashboardRouteFromRole } from "rapid-cortex-shared";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";

export default async function CallAssistAppIndexPage() {
  const user = await getDashboardSessionUser();
  if (!user) {
    redirect("/login?from=/app/call-assist");
  }
  redirect(dashboardRouteFromRole(user.role, user.agencyId));
}
