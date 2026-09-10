import type { NextRequest } from "next/server";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

type Ctx = { params: Promise<{ path: string[] }> };

async function proxy(request: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxyToAuthUpstream(request, `/api/vision/${path.map(encodeURIComponent).join("/")}`);
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
