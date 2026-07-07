import { NextRequest, NextResponse } from "next/server";
import { canAccessRcRevenuePortal } from "rapid-cortex-shared";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { upstreamBillingFetch } from "@/lib/server/rc-admin-billing-upstream";

export async function GET(request: NextRequest) {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessRcRevenuePortal(user.role)) {
    return NextResponse.json({ ok: false, error: "Forbidden", code: "FORBIDDEN" }, { status: 403 });
  }

  const qs = request.nextUrl.searchParams.toString();
  const path = `/api/admin/pricing/audit${qs ? `?${qs}` : ""}`;

  try {
    const upstream = await upstreamBillingFetch(request, path, {
      signal: AbortSignal.timeout(30_000),
    });
    const responseBody = await upstream.text();
    return new NextResponse(responseBody, {
      status: upstream.status,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    console.error("[pricing audit proxy]", err);
    return NextResponse.json(
      { ok: false, error: "Upstream service unavailable.", code: "UPSTREAM_ERROR" },
      { status: 502 },
    );
  }
}
