import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { COOKIE_ID_TOKEN } from "@/lib/auth/cookies";
import { resolveUpstreamApiBase } from "@/lib/comms-api-path";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

type Ctx = { params: Promise<{ segments?: string[] }> };

function upstreamPath(segments: string[] | undefined): string {
  const tail = segments?.length ? `/${segments.join("/")}` : "";
  return `/api/cameras/providers${tail}`;
}

async function proxyNestConnect(request: NextRequest, segments: string[] | undefined) {
  const path = upstreamPath(segments);
  const base = resolveUpstreamApiBase(path);
  if (!base) {
    return NextResponse.json({ error: "API_UPSTREAM_BASE_4 is not configured" }, { status: 503 });
  }

  const token = request.cookies.get(COOKIE_ID_TOKEN)?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.text();
  const target = new URL(`${base}${path}`);
  const upstream = await fetch(target, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body,
    cache: "no-store",
  });

  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
  });
}

async function proxyProviders(request: NextRequest, segments: string[] | undefined) {
  const path = upstreamPath(segments);
  const isNestConnect =
    path === "/api/cameras/providers/nest/connect" && request.method === "POST";
  if (isNestConnect) {
    return proxyNestConnect(request, segments);
  }
  return proxyToAuthUpstream(request, path);
}

export async function GET(request: NextRequest, ctx: Ctx) {
  const { segments } = await ctx.params;
  return proxyProviders(request, segments);
}

export async function POST(request: NextRequest, ctx: Ctx) {
  const { segments } = await ctx.params;
  return proxyProviders(request, segments);
}

export async function PUT(request: NextRequest, ctx: Ctx) {
  const { segments } = await ctx.params;
  return proxyProviders(request, segments);
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const { segments } = await ctx.params;
  return proxyProviders(request, segments);
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const { segments } = await ctx.params;
  return proxyProviders(request, segments);
}
