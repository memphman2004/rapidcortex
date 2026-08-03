import { NextRequest, NextResponse } from "next/server";
import { canAccessRcFinancePortal } from "rapid-cortex-shared";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isHiringUiEnabled } from "@/lib/runtime-flags";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

type Ctx = { params: Promise<{ applicationId: string }> };

export async function POST(request: NextRequest, context: Ctx) {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessRcFinancePortal(user.role) || !isHiringUiEnabled()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { applicationId } = await context.params;
  return proxyToAuthUpstream(
    request,
    `/api/rc-admin/applications/${encodeURIComponent(applicationId)}/notes`,
  );
}
