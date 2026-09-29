import type { NextRequest } from "next/server";
import { proxyToAuthUpstream } from "@/lib/api/proxy-to-auth-upstream";

type Ctx = { params: Promise<{ agencyId: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  const { agencyId } = await ctx.params;
  const qs = request.nextUrl.searchParams.toString();
  return proxyToAuthUpstream(
    request,
    `/api/campus/${encodeURIComponent(agencyId)}/pickup-auth${qs ? `?${qs}` : ""}`,
  );
}

export async function PUT(request: NextRequest, ctx: Ctx) {
  const { agencyId } = await ctx.params;
  return proxyToAuthUpstream(
    request,
    `/api/campus/${encodeURIComponent(agencyId)}/pickup-auth`,
  );
}
