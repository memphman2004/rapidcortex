import { NextRequest } from "next/server";
import { rapidIqPipelineRouteGate } from "@/lib/server/rapid-iq-pipeline-route-gate";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  const denied = await rapidIqPipelineRouteGate();
  if (denied) return denied;
  const { id } = await ctx.params;
  return proxyToAuthUpstream(request, `/api/watch/signals/${encodeURIComponent(id)}`);
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const denied = await rapidIqPipelineRouteGate();
  if (denied) return denied;
  const { id } = await ctx.params;
  return proxyToAuthUpstream(request, `/api/watch/signals/${encodeURIComponent(id)}`);
}
