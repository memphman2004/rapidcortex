import { NextRequest } from "next/server";
import { rapidIqRouteGate } from "@/lib/server/rapid-iq-route-gate";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

export async function POST(request: NextRequest) {
  const denied = await rapidIqRouteGate();
  if (denied) return denied;
  return proxyToAuthUpstream(request, "/api/rapid-iq/refresh");
}
