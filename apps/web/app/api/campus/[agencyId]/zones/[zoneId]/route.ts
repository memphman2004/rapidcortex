import type { NextRequest } from "next/server";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

type Ctx = { params: Promise<{ agencyId: string; zoneId: string }> };

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const { agencyId, zoneId } = await ctx.params;
  return proxyToAuthUpstream(
    request,
    `/api/campus/${encodeURIComponent(agencyId)}/zones/${encodeURIComponent(zoneId)}`,
  );
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const { agencyId, zoneId } = await ctx.params;
  return proxyToAuthUpstream(
    request,
    `/api/campus/${encodeURIComponent(agencyId)}/zones/${encodeURIComponent(zoneId)}`,
  );
}
