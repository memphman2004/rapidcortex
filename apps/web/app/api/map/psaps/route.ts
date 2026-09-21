import { NextRequest, NextResponse } from "next/server";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isPsapProspectsUiEnabled } from "@/lib/runtime-flags";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

export async function GET(request: NextRequest) {
  const user = await getDashboardSessionUser();
  if (!user || !isPsapProspectsUiEnabled()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return proxyToAuthUpstream(request, "/api/map/psaps");
}
