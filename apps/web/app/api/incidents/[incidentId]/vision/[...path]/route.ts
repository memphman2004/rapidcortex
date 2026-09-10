import type { NextRequest } from "next/server";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

type Ctx = { params: Promise<{ incidentId: string; path: string[] }> };

async function proxy(request: NextRequest, ctx: Ctx) {
  const { incidentId, path } = await ctx.params;
  const tail = path.map(encodeURIComponent).join("/");
  return proxyToAuthUpstream(
    request,
    `/api/incidents/${encodeURIComponent(incidentId)}/vision/${tail}`,
  );
}

export async function GET(request: NextRequest, ctx: Ctx) {
  return proxy(request, ctx);
}
export async function POST(request: NextRequest, ctx: Ctx) {
  return proxy(request, ctx);
}
export async function PATCH(request: NextRequest, ctx: Ctx) {
  return proxy(request, ctx);
}
