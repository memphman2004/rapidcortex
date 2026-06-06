import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { defaultPermissionForRole } from "rapid-cortex-security";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isHospitalRoutingEnabled } from "@/lib/runtime-flags";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ incidentId: string }> },
) {
  if (!isHospitalRoutingEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const user = await getDashboardSessionUser();
  if (!user || !defaultPermissionForRole(user.role, "hospital_routing.mci_plan")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { incidentId } = await context.params;
  return proxyToAuthUpstream(request, `/api/hospitals/mci/${encodeURIComponent(incidentId)}/activate`);
}
