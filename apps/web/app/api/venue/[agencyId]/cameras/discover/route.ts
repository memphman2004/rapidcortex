import type { NextRequest } from "next/server";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

type Ctx = { params: Promise<{ agencyId: string }> };

export async function POST(request: NextRequest, ctx: Ctx) {
  const { agencyId } = await ctx.params;
  return proxyToAuthUpstream(
    request,
    `/api/venue/${encodeURIComponent(agencyId)}/cameras/discover`,
    { method: "POST" },
  );
}
