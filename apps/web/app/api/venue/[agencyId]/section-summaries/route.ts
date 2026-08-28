import type { NextRequest } from "next/server";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

type Ctx = { params: Promise<{ agencyId: string }> };

/** Dashboard section KPIs with incident counts — stack 5 `GET /api/venue/{agencyId}/section-summaries`. */
export async function GET(request: NextRequest, ctx: Ctx) {
  const { agencyId } = await ctx.params;
  return proxyToAuthUpstream(
    request,
    `/api/venue/${encodeURIComponent(agencyId)}/section-summaries`,
  );
}
