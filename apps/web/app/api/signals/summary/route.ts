import { NextRequest, NextResponse } from "next/server";
import { canAccessNexiqSignals } from "rapid-cortex-shared";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isNexiqSignalsUiEnabled } from "@/lib/runtime-flags";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

export async function GET(request: NextRequest) {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessNexiqSignals(user.role) || !isNexiqSignalsUiEnabled()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return proxyToAuthUpstream(request, "/api/signals/summary");
}
