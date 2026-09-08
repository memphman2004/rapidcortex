import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { resolveUpstreamApiBase } from "@/lib/comms-api-path";

async function proxyWebhook(request: NextRequest, agencyId: string, slot: string) {
  const upstreamPath = `/api/public/cad-bridge/${encodeURIComponent(agencyId)}/${encodeURIComponent(slot)}/events`;
  const base = resolveUpstreamApiBase(upstreamPath);
  if (!base) {
    return NextResponse.json(
      { error: "API_UPSTREAM_BASE_2 is not configured for CAD Bridge public routes" },
      { status: 503 },
    );
  }
  const headers = new Headers();
  for (const name of [
    "content-type",
    "x-premierone-signature",
    "x-tyler-signature",
    "x-cad-signature",
    "x-hexagon-signature",
    "x-spillman-signature",
    "x-centralsquare-signature",
    "x-event-id",
    "x-rc-bridge-source",
  ]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const body = await request.text();
  const upstream = await fetch(`${base}${upstreamPath}`, {
    method: "POST",
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

type Ctx = { params: Promise<{ agencyId: string; slot: string }> };

export async function POST(request: NextRequest, ctx: Ctx) {
  const { agencyId, slot } = await ctx.params;
  return proxyWebhook(request, agencyId, slot);
}
