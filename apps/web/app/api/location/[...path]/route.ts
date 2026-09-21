import type { NextRequest } from "next/server";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

type Ctx = { params: Promise<{ path: string[] }> };

function geocodeSearch(request: NextRequest): string | undefined {
  const src = request.nextUrl.searchParams;
  if (!src.get("q") || src.get("address")) return undefined;
  const qs = new URLSearchParams();
  qs.set("address", src.get("q")!.trim());
  for (const key of ["lat", "lng"] as const) {
    const value = src.get(key);
    if (value) qs.set(key, value);
  }
  return `?${qs.toString()}`;
}

async function proxy(request: NextRequest, ctx: Ctx, search?: string) {
  const { path } = await ctx.params;
  return proxyToAuthUpstream(
    request,
    `/api/location/${path.map(encodeURIComponent).join("/")}`,
    search !== undefined ? { search } : undefined,
  );
}

export async function GET(request: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  const search = path[path.length - 1] === "geocode" ? geocodeSearch(request) : undefined;
  return proxy(request, ctx, search);
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
