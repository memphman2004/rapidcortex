import type { NextRequest } from "next/server";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

type Ctx = { params: Promise<{ agencyId: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  const { agencyId } = await ctx.params;
  const qs = request.nextUrl.searchParams.toString();
  const path = `/api/venue/${encodeURIComponent(agencyId)}/cameras${qs ? `?${qs}` : ""}`;
  return proxyToAuthUpstream(request, path);
}
