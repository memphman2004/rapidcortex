import { NextRequest, NextResponse } from "next/server";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { canViewPipeline } from "@/lib/sales/sales-authz";
import { isSalesToolsUiEnabled } from "@/lib/runtime-flags";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

export async function GET(request: NextRequest) {
  if (!isSalesToolsUiEnabled()) {
    return NextResponse.json({ error: "Sales Tools is not enabled" }, { status: 503 });
  }
  const user = await getDashboardSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canViewPipeline(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return proxyToAuthUpstream(request, "/api/sales/outlook/status");
}
