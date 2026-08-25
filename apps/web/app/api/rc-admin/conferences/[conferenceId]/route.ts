import { NextRequest, NextResponse } from "next/server";
import { conferencesRouteGate } from "@/lib/server/conferences-route-gate";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

type Ctx = { params: Promise<{ conferenceId: string }> };

export async function PATCH(request: NextRequest, context: Ctx) {
  const denied = await conferencesRouteGate();
  if (denied) return denied;
  const { conferenceId } = await context.params;
  if (!conferenceId?.trim()) {
    return NextResponse.json({ error: "conferenceId is required" }, { status: 400 });
  }
  return proxyToAuthUpstream(
    request,
    `/api/rc-admin/conferences/${encodeURIComponent(conferenceId)}`,
  );
}
