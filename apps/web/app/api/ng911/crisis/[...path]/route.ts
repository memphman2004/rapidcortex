import type { NextRequest } from "next/server";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxyToAuthUpstream(request, `/api/ng911/crisis/${path.map(encodeURIComponent).join("/")}`);
}

export async function POST(request: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxyToAuthUpstream(request, `/api/ng911/crisis/${path.map(encodeURIComponent).join("/")}`);
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxyToAuthUpstream(request, `/api/ng911/crisis/${path.map(encodeURIComponent).join("/")}`);
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxyToAuthUpstream(request, `/api/ng911/crisis/${path.map(encodeURIComponent).join("/")}`);
}
