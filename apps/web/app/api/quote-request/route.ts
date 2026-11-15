import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * Anonymous quote-request BFF — same-origin proxy on app.rapidcortex.us.
 * Also reachable from www marketing site (CORS open, auth NONE on Lambda).
 * Proxies to the primary API upstream (PostQuoteRequestFunction on stack-app-sam-3).
 */
const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST,OPTIONS",
  "access-control-allow-headers": "content-type",
} as const;

function upstreamBase(): string {
  // stack-3 reuses the same HttpApi as stack-1 (routed via API_UPSTREAM_BASE)
  return (
    process.env.API_UPSTREAM_BASE_3?.replace(/\/$/, "") ||
    process.env.API_UPSTREAM_BASE?.replace(/\/$/, "") ||
    ""
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { ...CORS_HEADERS } });
}

export async function POST(request: NextRequest) {
  const bodyText = await request.text();
  const base = upstreamBase();

  if (!base) {
    return new NextResponse(
      JSON.stringify({ error: "Quote request upstream not configured" }),
      {
        status: 503,
        headers: { "content-type": "application/json", ...CORS_HEADERS },
      },
    );
  }

  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(`${base}/api/quote-request`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: bodyText,
    });
  } catch (err) {
    console.error("quote-request BFF upstream fetch failed", err);
    return new NextResponse(
      JSON.stringify({ error: "Service unavailable" }),
      {
        status: 503,
        headers: { "content-type": "application/json", ...CORS_HEADERS },
      },
    );
  }

  const text = await upstreamRes.text();
  const headers = new Headers(upstreamRes.headers);
  for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
  return new NextResponse(text, { status: upstreamRes.status, headers });
}
