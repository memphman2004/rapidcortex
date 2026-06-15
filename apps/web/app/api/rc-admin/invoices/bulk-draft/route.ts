import { NextRequest, NextResponse } from "next/server";
import { canAccessRcRevenuePortal } from "rapid-cortex-shared";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { upstreamBillingFetch } from "@/lib/server/rc-admin-billing-upstream";

export async function POST(request: NextRequest) {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessRcRevenuePortal(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.text();

  try {
    const upstream = await upstreamBillingFetch(request, "/api/rc-admin/invoices/bulk-draft", {
      method: "POST",
      body,
      signal: AbortSignal.timeout(30_000),
    });
    const responseBody = await upstream.text();
    return new NextResponse(responseBody, {
      status: upstream.status,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    console.error("[bulk-draft proxy]", err);
    return NextResponse.json({ error: "Upstream service unavailable." }, { status: 502 });
  }
}
