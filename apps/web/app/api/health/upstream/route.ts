import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Unauthenticated HTTP API connectivity check (prior location: `GET /api/health`). */
export async function GET() {
  const base = process.env.API_UPSTREAM_BASE?.replace(/\/$/, "");
  if (!base) {
    return NextResponse.json(
      { error: "API_UPSTREAM_BASE is not configured" },
      { status: 500 },
    );
  }

  const upstream = await fetch(`${base}/api/health`, {
    method: "GET",
    headers: { accept: "application/json" },
    cache: "no-store",
  });

  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "application/json",
      "cache-control": "no-store, no-cache, must-revalidate",
    },
  });
}
