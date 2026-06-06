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

export async function GET(_request: NextRequest, ctx: Ctx) {
  const { token, segments } = await ctx.params;
  const enc = encodeURIComponent(token);
  if (segments?.length) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return proxyUpstream(`/api/public/incident-media/t/${enc}`);
}

export async function POST(request: NextRequest, ctx: Ctx) {
  const { token, segments } = await ctx.params;
  const enc = encodeURIComponent(token);
  const sub = segments?.[0];
  const body = await request.text();
  const init: RequestInit = { method: "POST", body: body || undefined };
  const map: Record<string, string> = {
    "upload-url": `/api/public/incident-media/t/${enc}/upload-url`,
    confirm: `/api/public/incident-media/t/${enc}/confirm`,
  };
  const path = sub ? map[sub] : undefined;
  if (!path) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return proxyUpstream(path, init);
}
