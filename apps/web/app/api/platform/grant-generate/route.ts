import { NextRequest, NextResponse } from "next/server";
import { isRcAdmin, isRcSuperAdmin } from "rapid-cortex-security";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isGrantSuccessProgramUiEnabled } from "@/lib/runtime-flags";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";
import {
  canInvokeGrantGenerateLambda,
  invokeGrantGenerateLambda,
} from "@/lib/server/grant-generate-invoke";

/**
 * Grant Success Program package generation — rcsuperadmin/rcadmin only.
 * Prefer direct Lambda Invoke (60s Anthropic budget) when configured;
 * otherwise fall back to API Gateway proxy (hard 30s cap).
 */
export async function POST(request: NextRequest) {
  const user = await getDashboardSessionUser();
  if (
    !user ||
    (!isRcSuperAdmin(user.role) && !isRcAdmin(user.role)) ||
    !isGrantSuccessProgramUiEnabled()
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (canInvokeGrantGenerateLambda()) {
    return invokeGrantGenerateLambda(request);
  }
  return proxyToAuthUpstream(request, "/api/platform/grant-generate");
}
