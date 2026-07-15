import { NextRequest, NextResponse } from "next/server";
import { isRcAdmin, isRcSuperAdmin } from "rapid-cortex-security";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isGrantSuccessProgramUiEnabled } from "@/lib/runtime-flags";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

/** Grant Success Program package generation — rcsuperadmin/rcadmin only; API call happens server-side in apps/api. */
export async function POST(request: NextRequest) {
  const user = await getDashboardSessionUser();
  if (
    !user ||
    (!isRcSuperAdmin(user.role) && !isRcAdmin(user.role)) ||
    !isGrantSuccessProgramUiEnabled()
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return proxyToAuthUpstream(request, "/api/platform/grant-generate");
}
