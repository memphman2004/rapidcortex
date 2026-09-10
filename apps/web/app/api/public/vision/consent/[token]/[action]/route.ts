import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { resolveUpstreamApiBase } from "@/lib/comms-api-path";

type Ctx = { params: Promise<{ token: string; action: string }> };

async function proxyConsent(request: NextRequest, token: string, action: string) {
  const upstreamPath = `/api/public/vision/consent/${encodeURIComponent(token)}/${encodeURIComponent(action)}`;
  const base = resolveUpstreamApiBase(upstreamPath);
  if (!base) {
    return NextResponse.json(
      { error: "API_UPSTREAM_BASE_2 is not configured for Rapid Vision™ public routes" },
      { status: 503 },
    );
  }
  const upstream = await fetch(`${base}${upstreamPath}`, {
    method: "GET",
    cache: "no-store",
  });
  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
  });
}

export async function GET(request: NextRequest, ctx: Ctx) {
  const { token, action } = await ctx.params;
  if (action !== "approve" && action !== "decline") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return proxyConsent(request, token, action);
}
