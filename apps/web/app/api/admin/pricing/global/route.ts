import { NextRequest, NextResponse } from "next/server";
import { canAccessRcRevenuePortal } from "rapid-cortex-shared";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { upstreamBillingFetch } from "@/lib/server/rc-admin-billing-upstream";

async function proxyPricing(request: NextRequest, upstreamPath: string, method: string) {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessRcRevenuePortal(user.role)) {
    return NextResponse.json({ ok: false, error: "Forbidden", code: "FORBIDDEN" }, { status: 403 });
  }

  const body =
    method === "GET" || method === "HEAD" ? undefined : await request.text();

  try {
    const upstream = await upstreamBillingFetch(request, upstreamPath, {
      method,
      body,
      signal: AbortSignal.timeout(30_000),
    });
    const responseBody = await upstream.text();
    return new NextResponse(responseBody, {
      status: upstream.status,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    console.error("[pricing proxy]", upstreamPath, err);
    return NextResponse.json(
      { ok: false, error: "Upstream service unavailable.", code: "UPSTREAM_ERROR" },
      { status: 502 },
    );
  }
}

export async function GET(request: NextRequest) {
  return proxyPricing(request, "/api/admin/pricing/global", "GET");
}

export async function PUT(request: NextRequest) {
  return proxyPricing(request, "/api/admin/pricing/global", "PUT");
}
