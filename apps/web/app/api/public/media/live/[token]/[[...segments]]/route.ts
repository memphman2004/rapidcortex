import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

async function proxyUpstream(path: string, init?: RequestInit) {
  const base = process.env.API_UPSTREAM_BASE?.replace(/\/$/, "");
  if (!base) {
    return NextResponse.json({ error: "API_UPSTREAM_BASE is not configured" }, { status: 500 });
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

type Ctx = { params: Promise<{ token: string; segments?: string[] }> };

export async function POST(request: NextRequest, ctx: Ctx) {
  const { token, segments } = await ctx.params;
  const sub = segments?.[0];
  const enc = encodeURIComponent(token);
  const body = await request.text();
  const init: RequestInit = { method: "POST", body: body || undefined };
  const map: Record<string, string> = {
    join: `/api/media/live/${enc}/join`,
    heartbeat: `/api/media/live/${enc}/heartbeat`,
  };
  const path = sub ? map[sub] : undefined;
  if (!path) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return proxyUpstream(path, init);
}
