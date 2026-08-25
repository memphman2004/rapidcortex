import { NextRequest } from "next/server";
import { rapidIqPipelineRouteGate } from "@/lib/server/rapid-iq-pipeline-route-gate";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

export async function POST(request: NextRequest) {
  const denied = await rapidIqPipelineRouteGate();
  if (denied) return denied;
  return proxyToAuthUpstream(request, "/api/rapid-iq/pipeline/research");
}
