import { NextRequest, NextResponse } from "next/server";
import { canAccessRcFinancePortal } from "rapid-cortex-shared";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isSalesLeadsUiEnabled } from "@/lib/runtime-flags";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

async function gate() {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessRcFinancePortal(user.role) || !isSalesLeadsUiEnabled()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

type Ctx = { params: Promise<{ leadId: string }> };

export async function PATCH(request: NextRequest, context: Ctx) {
  const denied = await gate();
  if (denied) return denied;
  const { leadId } = await context.params;
  if (!leadId?.trim()) return NextResponse.json({ error: "leadId is required" }, { status: 400 });
  return proxyToAuthUpstream(
    request,
    `/api/rc-admin/leads/${encodeURIComponent(leadId)}/fields`,
  );
}
