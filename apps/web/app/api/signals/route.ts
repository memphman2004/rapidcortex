import { NextRequest, NextResponse } from "next/server";
import { canAccessNexiqSignals } from "rapid-cortex-shared";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isNexiqSignalsUiEnabled } from "@/lib/runtime-flags";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

async function gate() {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessNexiqSignals(user.role) || !isNexiqSignalsUiEnabled()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

/** Browser BFF — GET only. POST ingest is IAM-only on API Gateway (no BFF POST). */
export async function GET(request: NextRequest) {
  const denied = await gate();
  if (denied) return denied;
  return proxyToAuthUpstream(request, "/api/signals");
}

export async function POST() {
  return NextResponse.json(
    { error: "Method Not Allowed", hint: "POST /api/signals requires AWS IAM (SigV4) upstream" },
    { status: 405 },
  );
}
