import { NextRequest, NextResponse } from "next/server";
import { canAccessSalesLeadsCrm, type LeadVertical } from "rapid-cortex-shared";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

/**
 * Grant matches for a lead — requires ?vertical= so the BFF/API never returns
 * another product vertical's matches.
 */
export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ leadId: string }> },
) {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessSalesLeadsCrm(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { leadId } = await ctx.params;
  const vertical = (request.nextUrl.searchParams.get("vertical") ?? "").trim() as LeadVertical;
  if (!vertical || vertical === "unknown") {
    return NextResponse.json({ error: "vertical query required" }, { status: 400 });
  }
  return proxyToAuthUpstream(
    request,
    `/api/rc-admin/leads/${encodeURIComponent(leadId)}/grant-matches?vertical=${encodeURIComponent(vertical)}`,
  );
}
