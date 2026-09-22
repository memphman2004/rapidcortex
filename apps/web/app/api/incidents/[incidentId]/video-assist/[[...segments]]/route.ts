import type { NextRequest } from "next/server";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

type Ctx = { params: Promise<{ incidentId: string; segments?: string[] }> };

async function proxy(request: NextRequest, ctx: Ctx) {
  const { incidentId, segments = [] } = await ctx.params;
  const tail = segments.map(encodeURIComponent).join("/");
  const path = `/api/incidents/${encodeURIComponent(incidentId)}/video-assist${tail ? `/${tail}` : ""}`;
  return proxyToAuthUpstream(request, path);
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
export async function DELETE(request: NextRequest, ctx: Ctx) {
  return proxy(request, ctx);
}
