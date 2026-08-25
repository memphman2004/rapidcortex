import { NextRequest } from "next/server";
import { rapidIqPipelineRouteGate } from "@/lib/server/rapid-iq-pipeline-route-gate";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

/** Spec path — proxies to existing pipeline Lambda route. */
export async function GET(request: NextRequest) {
  const denied = await rapidIqPipelineRouteGate();
  if (denied) return denied;
  return proxyToAuthUpstream(request, "/api/rapid-iq/pipeline/signals");
}

export async function POST(request: NextRequest) {
  const denied = await rapidIqPipelineRouteGate();
  if (denied) return denied;
  return proxyToAuthUpstream(request, "/api/rapid-iq/pipeline/signals");
}
