import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { resolveUpstreamApiBase } from "@/lib/comms-api-path";

async function proxySelfService(request: NextRequest, token: string) {
  const upstreamPath = `/api/public/call-assist/self-service/${encodeURIComponent(token)}`;
  const base = resolveUpstreamApiBase(upstreamPath);
  if (!base) {
    return NextResponse.json(
      { error: "API_UPSTREAM_BASE_2 is not configured for Call Assist public routes" },
      { status: 503 },
    );
  }
  const headers = new Headers();
  const ct = request.headers.get("content-type");
  if (ct) headers.set("content-type", ct);
  const body = request.method === "GET" ? undefined : await request.text();
  const upstream = await fetch(`${base}${upstreamPath}`, {
    method: request.method,
    headers,
    body: body || undefined,
    cache: "no-store",
  });
  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
  });
}

type Ctx = { params: Promise<{ token: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  const { token } = await ctx.params;
  return proxySelfService(request, token);
}

export async function POST(request: NextRequest, ctx: Ctx) {
  const { token } = await ctx.params;
  return proxySelfService(request, token);
}
