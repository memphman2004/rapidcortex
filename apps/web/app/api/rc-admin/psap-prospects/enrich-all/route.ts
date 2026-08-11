import { NextRequest, NextResponse } from "next/server";
import { canAccessRcFinancePortal } from "rapid-cortex-shared";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isPsapProspectsUiEnabled } from "@/lib/runtime-flags";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

async function gate() {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessRcFinancePortal(user.role) || !isPsapProspectsUiEnabled()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export async function POST(request: NextRequest) {
  const denied = await gate();
  if (denied) return denied;
  return proxyToAuthUpstream(request, "/api/rc-admin/psap-prospects/enrich-all");
}
