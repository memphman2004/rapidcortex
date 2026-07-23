import { NextRequest, NextResponse } from "next/server";
import { canAccessRcFinancePortal } from "rapid-cortex-shared";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isSalesLeadsUiEnabled } from "@/lib/runtime-flags";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

type Ctx = { params: Promise<{ leadId: string; noteId: string }> };

export async function DELETE(request: NextRequest, context: Ctx) {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessRcFinancePortal(user.role) || !isSalesLeadsUiEnabled()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { leadId, noteId } = await context.params;
  if (!leadId?.trim() || !noteId?.trim()) {
    return NextResponse.json({ error: "leadId and noteId are required" }, { status: 400 });
  }
  return proxyToAuthUpstream(
    request,
    `/api/rc-admin/leads/${encodeURIComponent(leadId)}/notes/${encodeURIComponent(noteId)}`,
  );
}
