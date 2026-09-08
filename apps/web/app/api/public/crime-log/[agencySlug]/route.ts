import type { NextRequest } from "next/server";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

type Ctx = { params: Promise<{ agencySlug: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  const { agencySlug } = await ctx.params;
  return proxyToAuthUpstream(request, `/api/public/crime-log/${encodeURIComponent(agencySlug)}`, {
    allowAnonymous: true,
  });
}
