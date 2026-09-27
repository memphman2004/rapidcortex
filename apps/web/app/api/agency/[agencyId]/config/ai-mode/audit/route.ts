import type { NextRequest } from "next/server";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

type Ctx = { params: Promise<{ agencyId: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  const { agencyId } = await ctx.params;
  const qs = request.nextUrl.search ?? "";
  return proxyToAuthUpstream(
    request,
    `/api/agency/${encodeURIComponent(agencyId)}/config/ai-mode/audit${qs}`,
  );
}
