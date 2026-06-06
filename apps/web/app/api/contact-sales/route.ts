import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  submitContactSalesLeadUpstream,
  validateContactSalesBody,
} from "@/lib/server/contact-sales-submit";

/**
 * Anonymous lead capture — same-origin BFF (no browser→API CORS).
 * Proxies to stack 2 when `API_UPSTREAM_BASE_2` is set, then primary API (`API_UPSTREAM_BASE`).
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST,OPTIONS",
      "access-control-allow-headers": "content-type",
    },
  });
}

export async function POST(request: NextRequest) {
  const bodyRaw = await request.text();
  const validated = validateContactSalesBody(bodyRaw);
  if (!validated.ok) {
    return validated.response;
  }

  const contentType = request.headers.get("content-type") ?? "application/json";
  const upstreamRes = await submitContactSalesLeadUpstream(validated.bodyText, contentType);
  const text = await upstreamRes.text();
  return new NextResponse(text, {
    status: upstreamRes.status,
    headers: Object.fromEntries(upstreamRes.headers.entries()),
  });
}
