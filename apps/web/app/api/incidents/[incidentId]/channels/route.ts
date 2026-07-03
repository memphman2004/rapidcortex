import type { NextRequest } from "next/server";
import { withFeatureContract } from "@/lib/rapid-cortex/contract-response";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

type Ctx = { params: Promise<{ incidentId: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  const { incidentId } = await ctx.params;
  return withFeatureContract("channel_talk_group_monitoring", async () =>
    proxyToAuthUpstream(request, `/api/incidents/${encodeURIComponent(incidentId)}/channels`),
  );
}

export async function POST(request: NextRequest, ctx: Ctx) {
  const { incidentId } = await ctx.params;
  return withFeatureContract("channel_talk_group_monitoring", async () =>
    proxyToAuthUpstream(request, `/api/incidents/${encodeURIComponent(incidentId)}/channels`),
  );
}
