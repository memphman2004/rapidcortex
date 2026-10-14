import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { resolveUpstreamApiBase } from "@/lib/comms-api-path";

export async function POST(request: NextRequest) {
  const base = resolveUpstreamApiBase("/api/public/campus-alerts/verify/confirm");
  if (!base) {
    return NextResponse.json({ error: "API upstream not configured" }, { status: 503 });
  }
  const body = await request.arrayBuffer();
  const upstream = await fetch(`${base}/api/public/campus-alerts/verify/confirm`, {
    method: "POST",
    headers: {
      "content-type": request.headers.get("content-type") ?? "application/json",
    },
    body: body.byteLength ? body : undefined,
  });
  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
  });
}
