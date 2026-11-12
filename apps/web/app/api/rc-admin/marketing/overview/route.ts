import { NextRequest, NextResponse } from "next/server";
import { canAccessSalesLeadsCrm } from "rapid-cortex-shared";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isMarketingDashboardEnabled } from "@/lib/runtime-flags";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

export async function GET(request: NextRequest) {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessSalesLeadsCrm(user.role) || !isMarketingDashboardEnabled()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  // Proxy filters through as query params; the API handler does further RBAC + scoping
  return proxyToAuthUpstream(request, "/api/rc-admin/leads/marketing/overview");
}
