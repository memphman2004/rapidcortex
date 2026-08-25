import { NextRequest } from "next/server";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

type Ctx = { params: Promise<{ token: string }> };

/** Public viewer lookup — anonymous allowed upstream. */
export async function GET(request: NextRequest, ctx: Ctx) {
  const { token } = await ctx.params;
  return proxyToAuthUpstream(request, `/api/escalations/viewer/${encodeURIComponent(token)}`, {
    allowAnonymous: true,
  });
}
