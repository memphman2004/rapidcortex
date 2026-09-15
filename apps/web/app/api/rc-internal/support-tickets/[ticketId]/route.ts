import { NextRequest, NextResponse } from "next/server";
import { isRcInternalOperator } from "rapid-cortex-shared";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isSupportFormUiEnabled } from "@/lib/runtime-flags";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

async function gate() {
  const user = await getDashboardSessionUser();
  if (!user || !isRcInternalOperator(user.role) || !isSupportFormUiEnabled()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ ticketId: string }> },
) {
  const denied = await gate();
  if (denied) return denied;
  const { ticketId } = await context.params;
  return proxyToAuthUpstream(request, `/api/rc-internal/support-tickets/${encodeURIComponent(ticketId)}`);
}
