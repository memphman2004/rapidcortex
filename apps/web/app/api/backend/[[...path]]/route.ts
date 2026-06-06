import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { COOKIE_ID_TOKEN } from "@/lib/auth/cookies";
import { isCommsPlatformApiPath, resolveUpstreamApiBase } from "@/lib/comms-api-path";

async function proxy(request: NextRequest, pathSegments: string[]) {
  const path = `/${pathSegments.join("/")}`;
  const base = resolveUpstreamApiBase(path);
  if (!base) {
    const needsStack2 = isCommsPlatformApiPath(path);
    return NextResponse.json(
      {
        error: needsStack2
          ? "API_UPSTREAM_BASE_2 is not configured for comms / call-intelligence routes"
          : "API_UPSTREAM_BASE is not configured",
        hint: needsStack2
          ? "Set API_UPSTREAM_BASE_2 to the stack-2 API Gateway URL (see scripts/print-stack-outputs-for-web.sh)."
          : "Set API_UPSTREAM_BASE on the web container.",
      },
      { status: 503 },
    );
  }

  const token = request.cookies.get(COOKIE_ID_TOKEN)?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const target = new URL(`${base}${path}`);
  target.search = request.nextUrl.search;

  const headers = new Headers();
  const incomingCt = request.headers.get("content-type");
  if (incomingCt) headers.set("content-type", incomingCt);
  headers.set("authorization", `Bearer ${token}`);

  const method = request.method;
  const body =
    method === "GET" || method === "HEAD" ? undefined : await request.arrayBuffer();

  const upstream = await fetch(target, { method, headers, body: body && body.byteLength ? body : undefined });

  const resHeaders = new Headers();
  const ct = upstream.headers.get("content-type");
  if (ct) resHeaders.set("content-type", ct);

  return new NextResponse(upstream.body, { status: upstream.status, headers: resHeaders });
}

type Ctx = { params: Promise<{ path?: string[] }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  const { path = [] } = await ctx.params;
  return proxy(request, path);
}

export async function POST(request: NextRequest, ctx: Ctx) {
  const { path = [] } = await ctx.params;
  return proxy(request, path);
}

export async function PUT(request: NextRequest, ctx: Ctx) {
  const { path = [] } = await ctx.params;
  return proxy(request, path);
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const { path = [] } = await ctx.params;
  return proxy(request, path);
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const { path = [] } = await ctx.params;
  return proxy(request, path);
}
