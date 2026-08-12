import { NextRequest } from "next/server";
import { rapidIqPipelineRouteGate } from "@/lib/server/rapid-iq-pipeline-route-gate";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

type Ctx = { params: Promise<{ signalId: string }> };

export async function POST(request: NextRequest, ctx: Ctx) {
  const denied = await rapidIqPipelineRouteGate();
  if (denied) return denied;
  const { signalId } = await ctx.params;
  return proxyToAuthUpstream(
    request,
    `/api/rapid-iq/pipeline/signals/${signalId}/push-to-crm`,
  );
}
