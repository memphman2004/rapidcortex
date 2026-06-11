import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { resolveUpstreamApiBase } from "@/lib/comms-api-path";

async function proxy(path: string, init?: RequestInit) {
  const base = resolveUpstreamApiBase(path);
  if (!base) {
    return NextResponse.json({ error: "API_UPSTREAM_BASE is not configured" }, { status: 500 });
  }
  const headers = new Headers();
  const ct = init?.headers instanceof Headers ? init.headers.get("content-type") : null;
  if (ct) headers.set("content-type", ct);
  else if (init?.body) headers.set("content-type", "application/json");

  const res = await fetch(`${base}${path}`, { ...init, headers, body: init?.body });
  const out = new Headers();
  const oct = res.headers.get("content-type");
  if (oct) out.set("content-type", oct);
  const buf = await res.arrayBuffer();
  return new NextResponse(buf.byteLength ? buf : null, { status: res.status, headers: out });
}

type Ctx = { params: Promise<{ phoneNumber: string }> };

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const { phoneNumber } = await ctx.params;
  const body = await request.text();
  return proxy(`/api/sms-routing/${encodeURIComponent(phoneNumber)}`, {
    method: "PATCH",
    body: body || undefined,
  });
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  const { phoneNumber } = await ctx.params;
  return proxy(`/api/sms-routing/${encodeURIComponent(phoneNumber)}`, { method: "DELETE" });
}
