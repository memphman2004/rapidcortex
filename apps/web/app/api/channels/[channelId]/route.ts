import type { NextRequest } from "next/server";
import { withFeatureContract } from "@/lib/rapid-cortex/contract-response";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

type Ctx = { params: Promise<{ channelId: string }> };

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const { channelId } = await ctx.params;
  return withFeatureContract("channel_talk_group_monitoring", async () =>
    proxyToAuthUpstream(request, `/api/channels/${encodeURIComponent(channelId)}`),
  );
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const { channelId } = await ctx.params;
  return withFeatureContract("channel_talk_group_monitoring", async () =>
    proxyToAuthUpstream(request, `/api/channels/${encodeURIComponent(channelId)}`),
  );
}
