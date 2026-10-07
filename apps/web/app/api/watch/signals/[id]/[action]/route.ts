import { NextRequest } from "next/server";
import { rapidIqPipelineRouteGate } from "@/lib/server/rapid-iq-pipeline-route-gate";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

type Ctx = { params: Promise<{ id: string; action: string }> };

const ALLOWED = new Set(["qualify", "dismiss", "monitor", "assign"]);

export async function POST(request: NextRequest, ctx: Ctx) {
  const denied = await rapidIqPipelineRouteGate();
  if (denied) return denied;
  const { id, action } = await ctx.params;
  if (!ALLOWED.has(action)) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return proxyToAuthUpstream(
    request,
    `/api/watch/signals/${encodeURIComponent(id)}/${encodeURIComponent(action)}`,
  );
}
