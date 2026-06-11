import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { COOKIE_ID_TOKEN } from "@/lib/auth/cookies";
import { resolveUpstreamApiBase } from "@/lib/comms-api-path";

/** Alias BFF — `/api/qr-codes` maps to upstream `/api/qr-nfc`. */
async function proxy(request: NextRequest, segments: string[]) {
  const path = `/api/qr-nfc${segments.length ? `/${segments.join("/")}` : ""}`;
  const base = resolveUpstreamApiBase(path);
  if (!base) {
    return NextResponse.json({ error: "API upstream not configured" }, { status: 503 });
  }

  const headers = new Headers();
  const ct = request.headers.get("content-type");
  if (ct) headers.set("content-type", ct);
  const token = request.cookies.get(COOKIE_ID_TOKEN)?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  headers.set("authorization", `Bearer ${token}`);

  const target = new URL(`${base}${path}`);
  target.search = request.nextUrl.search;
  const body =
    request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer();

  const upstream = await fetch(target, {
    method: request.method,
    headers,
    body: body && body.byteLength ? body : undefined,
  });

  const resHeaders = new Headers();
  const resCt = upstream.headers.get("content-type");
  if (resCt) resHeaders.set("content-type", resCt);
  return new NextResponse(upstream.body, { status: upstream.status, headers: resHeaders });
}

type Ctx = { params: Promise<{ segments?: string[] }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  const { segments = [] } = await ctx.params;
  return proxy(request, segments);
}

export async function POST(request: NextRequest, ctx: Ctx) {
  const { segments = [] } = await ctx.params;
  return proxy(request, segments);
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const { segments = [] } = await ctx.params;
  return proxy(request, segments);
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const { segments = [] } = await ctx.params;
  return proxy(request, segments);
}
