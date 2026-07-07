import { NextRequest, NextResponse } from "next/server";
import { canAccessRcRevenuePortal } from "rapid-cortex-shared";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { upstreamBillingFetch } from "@/lib/server/rc-admin-billing-upstream";

type RouteContext = { params: Promise<{ agencyId: string }> };

async function proxyTenant(
  request: NextRequest,
  agencyId: string,
  method: string,
) {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessRcRevenuePortal(user.role)) {
    return NextResponse.json({ ok: false, error: "Forbidden", code: "FORBIDDEN" }, { status: 403 });
  }

  const path = `/api/admin/pricing/tenants/${encodeURIComponent(agencyId)}`;
  const body =
    method === "GET" || method === "HEAD" ? undefined : await request.text();

  try {
    const upstream = await upstreamBillingFetch(request, path, {
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
    console.error("[pricing tenant proxy]", path, err);
    return NextResponse.json(
      { ok: false, error: "Upstream service unavailable.", code: "UPSTREAM_ERROR" },
      { status: 502 },
    );
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { agencyId } = await context.params;
  return proxyTenant(request, agencyId, "GET");
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const { agencyId } = await context.params;
  return proxyTenant(request, agencyId, "PUT");
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { agencyId } = await context.params;
  return proxyTenant(request, agencyId, "DELETE");
}
