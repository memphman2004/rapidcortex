import type { NextRequest } from "next/server";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ eapId: string }> },
) {
  const { eapId } = await ctx.params;
  return proxyToAuthUpstream(request, `/api/campus/eap/${encodeURIComponent(eapId)}`);
}

export async function DELETE(
  request: NextRequest,
  ctx: { params: Promise<{ eapId: string }> },
) {
  const { eapId } = await ctx.params;
  return proxyToAuthUpstream(request, `/api/campus/eap/${encodeURIComponent(eapId)}`);
}
