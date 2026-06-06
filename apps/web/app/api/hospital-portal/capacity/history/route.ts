import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { defaultPermissionForRole } from "rapid-cortex-security";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isHospitalPortalEnabled } from "@/lib/runtime-flags";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

export async function GET(request: NextRequest) {
  if (!isHospitalPortalEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const user = await getDashboardSessionUser();
  if (!user || !defaultPermissionForRole(user.role, "hospital_portal.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const limit = request.nextUrl.searchParams.get("limit") ?? "10";
  return proxyToAuthUpstream(request, `/api/hospital-portal/capacity/history?limit=${limit}`);
}
