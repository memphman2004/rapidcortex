import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { resolveUpstreamApiBase } from "@/lib/comms-api-path";

type Ctx = { params: Promise<{ token: string }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
  const { token } = await ctx.params;
  const path = `/api/public/escort-iq/${encodeURIComponent(token)}`;
  const base = resolveUpstreamApiBase(path);
  if (!base) {
    return NextResponse.json({ error: "API upstream not configured" }, { status: 503 });
  }
  const upstream = await fetch(`${base}${path}`, { method: "GET" });
  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
  });
}
