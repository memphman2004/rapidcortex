import { NextRequest, NextResponse } from "next/server";
import { isRcsuperadmin } from "rapid-cortex-shared";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const user = await getDashboardSessionUser();
  if (!user || !isRcsuperadmin(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await context.params;
  return proxyToAuthUpstream(request, `/api/rc-admin/pricing/config/${encodeURIComponent(id)}`);
}
