import { NextRequest, NextResponse } from "next/server";
import { canAccessSalesLeadsCrm, type LeadVertical } from "rapid-cortex-shared";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

/** Vertical-scoped signal feed — `vertical` query is required. */
export async function GET(request: NextRequest) {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessSalesLeadsCrm(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const vertical = (request.nextUrl.searchParams.get("vertical") ?? "").trim() as LeadVertical;
  if (!vertical || vertical === "unknown") {
    return NextResponse.json({ error: "vertical query required" }, { status: 400 });
  }
  try {
    return await proxyToAuthUpstream(
      request,
      `/api/rc-admin/signal-feed?vertical=${encodeURIComponent(vertical)}&days=${request.nextUrl.searchParams.get("days") ?? "30"}`,
    );
  } catch {
    // Upstream not deployed yet — empty feed for this vertical only
    return NextResponse.json({ signals: [], vertical });
  }
}
