import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { COOKIE_ID_TOKEN } from "@/lib/auth/cookies";
import { resolveUpstreamApiBase } from "@/lib/comms-api-path";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

type Ctx = { params: Promise<{ segments?: string[] }> };

function upstreamPath(segments: string[] | undefined): string {
  const tail = segments?.length ? `/${segments.join("/")}` : "";
  return `/api/integrations/ring${tail}`;
}

async function proxyRing(request: NextRequest, segments: string[] | undefined) {
  const path = upstreamPath(segments);
  const isOAuthLogin = path === "/api/integrations/ring/login" && request.method === "GET";
  if (!isOAuthLogin) {
    return proxyToAuthUpstream(request, path);
  }

  const base = resolveUpstreamApiBase(path);
  if (!base) {
    return NextResponse.json({ error: "API_UPSTREAM_BASE_4 is not configured" }, { status: 503 });
  }
  const token = request.cookies.get(COOKIE_ID_TOKEN)?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const target = new URL(`${base}${path}`);
  target.search = request.nextUrl.search;
  const upstream = await fetch(target, {
    method: "GET",
    headers: { authorization: `Bearer ${token}` },
    redirect: "manual",
    cache: "no-store",
  });

  const headers = new Headers();
  const location = upstream.headers.get("location");
  if (location) headers.set("location", location);
  const contentType = upstream.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);

  return new NextResponse(upstream.body, { status: upstream.status, headers });
}

export async function GET(request: NextRequest, ctx: Ctx) {
  const { segments } = await ctx.params;
  return proxyRing(request, segments);
}

export async function POST(request: NextRequest, ctx: Ctx) {
  const { segments } = await ctx.params;
  return proxyRing(request, segments);
}

export async function PUT(request: NextRequest, ctx: Ctx) {
  const { segments } = await ctx.params;
  return proxyRing(request, segments);
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const { segments } = await ctx.params;
  return proxyRing(request, segments);
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const { segments } = await ctx.params;
  return proxyRing(request, segments);
}
