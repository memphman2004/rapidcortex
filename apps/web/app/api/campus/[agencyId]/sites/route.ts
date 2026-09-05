import type { NextRequest } from "next/server";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

type Ctx = { params: Promise<{ agencyId: string }> };

function upstream(path: string, agencyId: string): string {
  return `/api/campus/${encodeURIComponent(agencyId)}${path}`;
}

export async function GET(request: NextRequest, ctx: Ctx) {
  const { agencyId } = await ctx.params;
  return proxyToAuthUpstream(request, upstream("/sites", agencyId));
}

export async function PUT(request: NextRequest, ctx: Ctx) {
  const { agencyId } = await ctx.params;
  return proxyToAuthUpstream(request, upstream("/sites", agencyId));
}
