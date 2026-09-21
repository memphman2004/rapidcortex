import type { NextRequest } from "next/server";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

type Ctx = { params: Promise<{ segments?: string[] }> };

async function proxy(request: NextRequest, ctx: Ctx) {
  const { segments = [] } = await ctx.params;
  const endpoint = `/api/supervisor/${segments.map(encodeURIComponent).join("/")}`.replace(/\/$/, "") ||
    "/api/supervisor";
  return proxyToAuthUpstream(request, endpoint);
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

export async function PUT(request: NextRequest, ctx: Ctx) {
  return proxy(request, ctx);
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  return proxy(request, ctx);
}
