import type { NextRequest } from "next/server";
import { proxyToAuthUpstream } from "@/lib/api/proxy-to-auth-upstream";

type Ctx = { params: Promise<{ agencyId: string }> };

export async function POST(request: NextRequest, ctx: Ctx) {
  const { agencyId } = await ctx.params;
  return proxyToAuthUpstream(
    request,
    `/api/campus/${encodeURIComponent(agencyId)}/visitors/check-in`,
  );
}
