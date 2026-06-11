import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { resolveUpstreamApiBase } from "@/lib/comms-api-path";

async function proxyUpstream(path: string, init?: RequestInit) {
  const base = resolveUpstreamApiBase(path);
  if (!base) {
    return NextResponse.json(
      { error: "API_UPSTREAM_BASE is not configured" },
      { status: 500 },
    );
  }
  const headers = new Headers();
  const ct = init?.headers && init.headers instanceof Headers ? init.headers.get("content-type") : null;
  if (ct) headers.set("content-type", ct);
  else if (init?.body) headers.set("content-type", "application/json");

  const res = await fetch(`${base}${path}`, {
    ...init,
    headers,
    body: init?.body,
  });
  const outHeaders = new Headers();
  const oct = res.headers.get("content-type");
  if (oct) outHeaders.set("content-type", oct);
  const buf = await res.arrayBuffer();
  return new NextResponse(buf.byteLength ? buf : null, { status: res.status, headers: outHeaders });
}

type Ctx = { params: Promise<{ token: string }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
  const { token } = await ctx.params;
  return proxyUpstream(`/api/public/locate/${encodeURIComponent(token)}`);
}

export async function POST(request: NextRequest, ctx: Ctx) {
  const { token } = await ctx.params;
  const body = await request.text();
  return proxyUpstream(`/api/public/locate/${encodeURIComponent(token)}`, {
    method: "POST",
    body: body || undefined,
  });
}
