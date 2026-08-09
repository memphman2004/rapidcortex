import { NextRequest, NextResponse } from "next/server";
import { rapidIqRouteGate } from "@/lib/server/rapid-iq-route-gate";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

type Ctx = { params: Promise<{ opportunityId: string }> };

export async function GET(request: NextRequest, context: Ctx) {
  const denied = await rapidIqRouteGate();
  if (denied) return denied;
  const { opportunityId } = await context.params;
  if (!opportunityId?.trim()) {
    return NextResponse.json({ error: "opportunityId is required" }, { status: 400 });
  }
  return proxyToAuthUpstream(
    request,
    `/api/rapid-iq/opportunities/${encodeURIComponent(opportunityId)}`,
  );
}

export async function PATCH(request: NextRequest, context: Ctx) {
  const denied = await rapidIqRouteGate();
  if (denied) return denied;
  const { opportunityId } = await context.params;
  if (!opportunityId?.trim()) {
    return NextResponse.json({ error: "opportunityId is required" }, { status: 400 });
  }
  return proxyToAuthUpstream(
    request,
    `/api/rapid-iq/opportunities/${encodeURIComponent(opportunityId)}`,
  );
}
