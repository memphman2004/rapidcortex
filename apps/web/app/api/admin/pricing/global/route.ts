import { NextRequest, NextResponse } from "next/server";
import {
  canAccessRcFinancePortal,
  canAccessRcRevenuePortal,
} from "rapid-cortex-shared";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { upstreamBillingFetch } from "@/lib/server/rc-admin-billing-upstream";

async function proxyPricing(request: NextRequest, upstreamPath: string, method: string) {
  const user = await getDashboardSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const isWrite = method !== "GET" && method !== "HEAD";
  if (isWrite) {
    if (!canAccessRcRevenuePortal(user.role)) {
      return NextResponse.json({ ok: false, error: "Forbidden", code: "FORBIDDEN" }, { status: 403 });
    }
  } else if (!canAccessRcFinancePortal(user.role)) {
    return NextResponse.json({ ok: false, error: "Forbidden", code: "FORBIDDEN" }, { status: 403 });
  }

  const body = isWrite ? await request.text() : undefined;

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
