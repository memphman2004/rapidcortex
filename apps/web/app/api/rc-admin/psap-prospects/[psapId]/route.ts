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

type Ctx = { params: Promise<{ psapId: string }> };

export async function GET(request: NextRequest, context: Ctx) {
  const denied = await gate();
  if (denied) return denied;
  const { psapId } = await context.params;
  if (!psapId?.trim()) return NextResponse.json({ error: "psapId is required" }, { status: 400 });
  return proxyToAuthUpstream(request, `/api/rc-admin/psap-prospects/${encodeURIComponent(psapId)}`);
}

export async function PATCH(request: NextRequest, context: Ctx) {
  const denied = await gate();
  if (denied) return denied;
  const { psapId } = await context.params;
  if (!psapId?.trim()) return NextResponse.json({ error: "psapId is required" }, { status: 400 });
  return proxyToAuthUpstream(request, `/api/rc-admin/psap-prospects/${encodeURIComponent(psapId)}`);
}
