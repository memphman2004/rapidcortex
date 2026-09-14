import type { NextRequest } from "next/server";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

type Ctx = { params: Promise<{ agencyId: string; path: string[] }> };

async function proxy(request: NextRequest, ctx: Ctx) {
  const { agencyId, path } = await ctx.params;
  const rest = path.map(encodeURIComponent).join("/");
  return proxyToAuthUpstream(
    request,
    `/api/video/${encodeURIComponent(agencyId)}/${rest}`,
  );
}

export async function GET(request: NextRequest, ctx: Ctx) {
  return proxy(request, ctx);
}
export async function PUT(request: NextRequest, ctx: Ctx) {
  return proxy(request, ctx);
}
export async function POST(request: NextRequest, ctx: Ctx) {
  return proxy(request, ctx);
}
export async function DELETE(request: NextRequest, ctx: Ctx) {
  return proxy(request, ctx);
}
