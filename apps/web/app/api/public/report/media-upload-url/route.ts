import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { resolveUpstreamApiBase } from "@/lib/comms-api-path";

/** Anonymous BFF → GET /api/public/report/media-upload-url?qrId=&type= */
export async function GET(request: NextRequest) {
  const base = resolveUpstreamApiBase("/api/public/report");
  if (!base) {
    return NextResponse.json({ error: "API upstream not configured" }, { status: 503 });
  }
  const qs = request.nextUrl.search;
  const upstream = await fetch(`${base}/api/public/report/media-upload-url${qs}`, {
    method: "GET",
    cache: "no-store",
  });
  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
  });
}
