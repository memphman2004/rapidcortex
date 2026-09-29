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
    // Query string is forwarded by proxyToAuthUpstream from the incoming request.
    // Path must resolve to API_UPSTREAM_BASE_3 (see isSam3ApiPath signal-feed rule).
    return await proxyToAuthUpstream(request, "/api/rc-admin/signal-feed");
  } catch {
    // Upstream not deployed yet — empty feed for this vertical only
    return NextResponse.json({ signals: [], vertical });
  }
}
