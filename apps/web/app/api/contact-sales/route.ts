import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  submitContactSalesLeadUpstream,
  validateContactSalesBody,
} from "@/lib/server/contact-sales-submit";

/**
 * Anonymous lead capture — same-origin BFF on app; also reachable from www marketing (CORS).
 * Proxies to stack 2 when `API_UPSTREAM_BASE_2` is set, then primary API (`API_UPSTREAM_BASE`).
 */
const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST,OPTIONS",
  "access-control-allow-headers": "content-type",
} as const;

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: { ...CORS_HEADERS },
  });
}

export async function POST(request: NextRequest) {
  const bodyRaw = await request.text();
  const validated = validateContactSalesBody(bodyRaw);
  if (!validated.ok) {
    const err = validated.response;
    const headers = new Headers(err.headers);
    for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
    return new NextResponse(err.body, { status: err.status, headers });
  }

  const contentType = request.headers.get("content-type") ?? "application/json";
  const upstreamRes = await submitContactSalesLeadUpstream(validated.bodyText, contentType);
  const text = await upstreamRes.text();
  const headers = new Headers(upstreamRes.headers);
  for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
  return new NextResponse(text, {
    status: upstreamRes.status,
    headers,
  });
}
