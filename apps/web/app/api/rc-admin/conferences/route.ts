import { NextRequest } from "next/server";
import { conferencesRouteGate } from "@/lib/server/conferences-route-gate";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

export async function GET(request: NextRequest) {
  const denied = await conferencesRouteGate();
  if (denied) return denied;
  return proxyToAuthUpstream(request, "/api/rc-admin/conferences");
}

export async function POST(request: NextRequest) {
  const denied = await conferencesRouteGate();
  if (denied) return denied;
  return proxyToAuthUpstream(request, "/api/rc-admin/conferences");
}
