import { NextRequest, NextResponse } from "next/server";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

/** National PSAP directory for dispatcher / supervisor maps — not the NexCort Admin CRM. */
export async function GET(request: NextRequest) {
  const user = await getDashboardSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return proxyToAuthUpstream(request, "/api/map/psaps");
}
