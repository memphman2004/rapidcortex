import { NextRequest, NextResponse } from "next/server";
import { canAccessRcFinancePortal } from "rapid-cortex-shared";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isPsapProspectsUiEnabled } from "@/lib/runtime-flags";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

type Ctx = { params: Promise<{ psapId: string }> };

export async function POST(request: NextRequest, context: Ctx) {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessRcFinancePortal(user.role) || !isPsapProspectsUiEnabled()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { psapId } = await context.params;
  if (!psapId?.trim()) return NextResponse.json({ error: "psapId is required" }, { status: 400 });
  return proxyToAuthUpstream(
    request,
    `/api/rc-admin/psap-prospects/${encodeURIComponent(psapId)}/activities`,
  );
}
