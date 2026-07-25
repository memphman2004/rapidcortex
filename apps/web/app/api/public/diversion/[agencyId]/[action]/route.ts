import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { resolveUpstreamApiBase } from "@/lib/comms-api-path";

type Ctx = { params: Promise<{ agencyId: string; action: string }> };

async function proxyPublicDiversion(request: NextRequest, agencyId: string, action: string) {
  const upstreamPath = `/api/public/diversion/${encodeURIComponent(agencyId)}/${action}`;
  const base = resolveUpstreamApiBase(upstreamPath);
  if (!base) {
    return NextResponse.json(
      { error: "API_UPSTREAM_BASE_2 is not configured for diversion routes" },
      { status: 503 },
    );
  }

  const body = await request.arrayBuffer();
  const headers = new Headers();
  headers.set("content-type", request.headers.get("content-type") ?? "application/json");
  const diversionKey =
    request.headers.get("x-diversion-key") ?? request.headers.get("X-Diversion-Key");
  if (diversionKey) headers.set("x-diversion-key", diversionKey);

  const upstream = await fetch(`${base}${upstreamPath}`, {
    method: "POST",
    headers,
    body: body.byteLength ? body : undefined,
    cache: "no-store",
  });

  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
  });
}

export async function POST(request: NextRequest, ctx: Ctx) {
  const { agencyId, action } = await ctx.params;
  if (!["start", "utterance", "confirm"].includes(action)) {
    return NextResponse.json({ error: "Unknown diversion action" }, { status: 404 });
  }
  return proxyPublicDiversion(request, agencyId, action);
}
