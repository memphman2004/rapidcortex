import type { NextRequest } from "next/server";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

type Ctx = { params: Promise<{ cardId: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  const { cardId } = await ctx.params;
  return proxyToAuthUpstream(request, `/api/public/c/${cardId}`, { allowAnonymous: true });
}
