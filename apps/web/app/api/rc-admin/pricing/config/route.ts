import { NextRequest, NextResponse } from "next/server";
import { canAccessRcFinancePortal, isRcsuperadmin } from "rapid-cortex-shared";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

export async function GET(request: NextRequest) {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessRcFinancePortal(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return proxyToAuthUpstream(request, "/api/rc-admin/pricing/config");
}

export async function PUT(request: NextRequest) {
  const user = await getDashboardSessionUser();
  if (!user || !isRcsuperadmin(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return proxyToAuthUpstream(request, "/api/rc-admin/pricing/config");
}
