import type { NextRequest } from "next/server";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

type Ctx = { params: Promise<{ entryId: string }> };

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const { entryId } = await ctx.params;
  return proxyToAuthUpstream(request, `/api/campus/clery/entries/${encodeURIComponent(entryId)}`);
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const { entryId } = await ctx.params;
  return proxyToAuthUpstream(request, `/api/campus/clery/entries/${encodeURIComponent(entryId)}`);
}
