import { redirect } from "next/navigation";
import {
  dashboardPathForRoute,
  getAppDashboardSession,
  getDashboardRouteForRole,
} from "../_lib/dashboard-session";

export default async function DashboardRoutePage() {
  const session = await getAppDashboardSession();
  const route = getDashboardRouteForRole(session.role);
  if (!route) {
    redirect("/auth/login?error=unknown_role");
  }
  redirect(dashboardPathForRoute(route));
}

