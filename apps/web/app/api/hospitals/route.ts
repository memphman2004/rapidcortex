import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { defaultPermissionForRole } from "rapid-cortex-security";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isEmergencyConnectEnabled } from "@/lib/runtime-flags";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

export async function GET(request: NextRequest) {
  if (!isEmergencyConnectEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const user = await getDashboardSessionUser();
  if (!user || !defaultPermissionForRole(user.role, "emergency_connect.prealert_create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return proxyToAuthUpstream(request, "/api/hospitals");
}

export async function POST(request: NextRequest) {
  if (!isEmergencyConnectEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const user = await getDashboardSessionUser();
  if (!user || !defaultPermissionForRole(user.role, "emergency_connect.hospital_manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return proxyToAuthUpstream(request, "/api/hospitals");
}
