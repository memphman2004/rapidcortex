import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { defaultPermissionForRole } from "rapid-cortex-security";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isHospitalRoutingEnabled } from "@/lib/runtime-flags";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ hospitalId: string }> },
) {
  if (!isHospitalRoutingEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const user = await getDashboardSessionUser();
  if (!user || !defaultPermissionForRole(user.role, "hospital_routing.analytics_view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { hospitalId } = await context.params;
  const days = request.nextUrl.searchParams.get("days") ?? "30";
  return proxyToAuthUpstream(
    request,
    `/api/hospitals/${encodeURIComponent(hospitalId)}/analytics/performance?days=${days}`,
  );
}
