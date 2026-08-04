import { NextRequest, NextResponse } from "next/server";
import { canAccessRcFinancePortal } from "rapid-cortex-shared";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isHiringUiEnabled } from "@/lib/runtime-flags";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

async function gate() {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessRcFinancePortal(user.role) || !isHiringUiEnabled()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export async function GET(request: NextRequest) {
  const denied = await gate();
  if (denied) return denied;
  return proxyToAuthUpstream(request, "/api/rc-admin/settings/hiring-bookings");
}

export async function PUT(request: NextRequest) {
  const denied = await gate();
  if (denied) return denied;
  return proxyToAuthUpstream(request, "/api/rc-admin/settings/hiring-bookings");
}
