import { NextRequest, NextResponse } from "next/server";
import { canAccessNexiqSignals } from "rapid-cortex-shared";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isNexiqSignalsUiEnabled } from "@/lib/runtime-flags";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

type Ctx = { params: Promise<{ signalId: string }> };

export async function PATCH(request: NextRequest, context: Ctx) {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessNexiqSignals(user.role) || !isNexiqSignalsUiEnabled()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { signalId } = await context.params;
  if (!signalId?.trim()) {
    return NextResponse.json({ error: "signalId is required" }, { status: 400 });
  }
  return proxyToAuthUpstream(
    request,
    `/api/signals/${encodeURIComponent(signalId)}`,
  );
}
