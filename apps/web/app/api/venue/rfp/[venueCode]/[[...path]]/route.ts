import type { NextRequest } from "next/server";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

type Ctx = { params: Promise<{ venueCode: string; path?: string[] }> };

function upstreamPath(venueCode: string, segments: string[] | undefined): string {
  const code = encodeURIComponent(venueCode.trim().toUpperCase());
  const tail = (segments ?? []).map((s) => encodeURIComponent(s)).join("/");
  return tail ? `/api/venue/${code}/rfp/${tail}` : `/api/venue/${code}/rfp`;
}

async function handle(request: NextRequest, ctx: Ctx) {
  const { venueCode, path } = await ctx.params;
  return proxyToAuthUpstream(request, upstreamPath(venueCode, path));
}

export async function GET(request: NextRequest, ctx: Ctx) {
  return handle(request, ctx);
}

export async function POST(request: NextRequest, ctx: Ctx) {
  return handle(request, ctx);
}

export async function PUT(request: NextRequest, ctx: Ctx) {
  return handle(request, ctx);
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  return handle(request, ctx);
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  return handle(request, ctx);
}
