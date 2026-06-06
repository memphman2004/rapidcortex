import type { NextRequest } from "next/server";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

type Ctx = { params: Promise<{ incidentId: string }> };

export async function POST(request: NextRequest, ctx: Ctx) {
  const { incidentId } = await ctx.params;
  return proxyToAuthUpstream(
    request,
    `/api/campus/incidents/${encodeURIComponent(incidentId)}/notes`,
  );
}
