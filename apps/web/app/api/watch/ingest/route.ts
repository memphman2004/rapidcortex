import { NextRequest, NextResponse } from "next/server";
import { rapidIqPipelineRouteGate } from "@/lib/server/rapid-iq-pipeline-route-gate";
import { joinUpstreamApiUrl, normalizeUpstreamApiPath } from "@/lib/upstream-url";
import { resolveUpstreamApiBase } from "@/lib/comms-api-path";

/**
 * Admin / machine ingest BFF.
 * - If Authorization: Bearer present (API key or caller-supplied), forward as-is.
 * - Else if RC admin session + server WATCH key configured, inject key for tester.
 */
export async function POST(request: NextRequest) {
  const denied = await rapidIqPipelineRouteGate();
  // Machine key callers may not have a browser session — allow when key header present.
  const authHeader = request.headers.get("authorization") ?? "";
  const hasBearer = authHeader.toLowerCase().startsWith("bearer ");
  const dedicated = request.headers.get("x-nexcort-watch-key");
  if (denied && !hasBearer && !dedicated) return denied;

  const path = normalizeUpstreamApiPath("/api/watch/ingest");
  const base = resolveUpstreamApiBase(path);
  if (!base) {
    return NextResponse.json(
      { error: "API_UPSTREAM_BASE_3 is not configured for watch ingest" },
      { status: 503 },
    );
  }

  const headers = new Headers();
  headers.set("content-type", request.headers.get("content-type") ?? "application/json");
  if (hasBearer) {
    headers.set("authorization", authHeader);
  } else if (dedicated) {
    headers.set("x-nexcort-watch-key", dedicated);
  } else {
    const key =
      process.env.RAPID_IQ_WATCH_INGEST_API_KEY?.trim() ||
      process.env.WATCH_INGEST_API_KEY?.trim() ||
      "";
    if (!key) {
      return NextResponse.json(
        {
          error: "Watch ingest API key is not configured on the web server",
          hint: "Set RAPID_IQ_WATCH_INGEST_API_KEY for admin tester, or POST with Authorization: Bearer <key>.",
        },
        { status: 503 },
      );
    }
    headers.set("authorization", `Bearer ${key}`);
  }

  const idem = request.headers.get("idempotency-key");
  if (idem) headers.set("idempotency-key", idem);

  const target = joinUpstreamApiUrl(base, path);
  const upstream = await fetch(target, {
    method: "POST",
    headers,
    body: await request.arrayBuffer(),
  });
  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
  });
}
