import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  submitMarketingLeadUpstream,
  validateMarketingLeadBody,
} from "@/lib/server/marketing-lead-submit";

/** Anonymous Inside the Cortex capture — same-origin BFF for marketing site. */
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
  const validated = validateMarketingLeadBody(bodyRaw);
  if (!validated.ok) return validated.response;

  const contentType = request.headers.get("content-type") ?? "application/json";
  const upstreamRes = await submitMarketingLeadUpstream(validated.bodyText, contentType);
  const text = await upstreamRes.text();
  return new NextResponse(text, {
    status: upstreamRes.status,
    headers: Object.fromEntries(upstreamRes.headers.entries()),
  });
}
