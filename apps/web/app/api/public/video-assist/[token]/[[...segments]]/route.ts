import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { resolveUpstreamApiBase } from "@/lib/comms-api-path";

async function proxyUpstream(path: string, init?: RequestInit) {
  const base = resolveUpstreamApiBase(path);
  if (!base) {
    return NextResponse.json(
      { error: "API_UPSTREAM_BASE (and stack-2 paths require API_UPSTREAM_BASE_2) is not configured" },
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

type Ctx = { params: Promise<{ token: string; segments?: string[] }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  const { token, segments } = await ctx.params;
  const enc = encodeURIComponent(token);
  if (!segments?.length) {
    return proxyUpstream(`/api/video-assist/t/${enc}`);
  }
  if (segments.length === 1 && segments[0] === "ice-config") {
    return proxyUpstream(`/api/video-assist/t/${enc}/ice-config`);
  }
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function POST(request: NextRequest, ctx: Ctx) {
  const { token, segments } = await ctx.params;
  const enc = encodeURIComponent(token);
  const sub = segments?.[0];
  const body = await request.text();
  const init: RequestInit = { method: "POST", body: body || undefined };
  if (!sub) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const map: Record<string, string> = {
    opened: `/api/video-assist/t/${enc}/opened`,
    consent: `/api/video-assist/t/${enc}/consent`,
    signal: `/api/video-assist/t/${enc}/signal`,
    end: `/api/video-assist/t/${enc}/end`,
  };
  const path = map[sub];
  if (!path) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return proxyUpstream(path, init);
}
