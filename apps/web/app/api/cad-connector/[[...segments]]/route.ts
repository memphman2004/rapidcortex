import type { NextRequest } from "next/server";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

type Ctx = { params: Promise<{ segments?: string[] }> };

function upstreamPath(segments: string[] | undefined): string {
  const tail = segments?.length ? `/${segments.join("/")}` : "";
  return `/api/cad-connector${tail}`;
}

export async function GET(request: NextRequest, ctx: Ctx) {
  const { segments } = await ctx.params;
  return proxyToAuthUpstream(request, upstreamPath(segments));
}

export async function POST(request: NextRequest, ctx: Ctx) {
  const { segments } = await ctx.params;
  return proxyToAuthUpstream(request, upstreamPath(segments));
}

export async function PUT(request: NextRequest, ctx: Ctx) {
  const { segments } = await ctx.params;
  return proxyToAuthUpstream(request, upstreamPath(segments));
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const { segments } = await ctx.params;
  return proxyToAuthUpstream(request, upstreamPath(segments));
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const { segments } = await ctx.params;
  return proxyToAuthUpstream(request, upstreamPath(segments));
}
