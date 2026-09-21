import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";
import { GET as getFeatureRegistry } from "@/app/api/features/route";

/**
 * Live dispatcher polls `GET /api/events/features?mini=1`.
 * Canonical feature registry is `/api/features`. Other `/api/events/*`
 * aliases map to Rapid Vision `/api/vision/events/*`.
 */

type Ctx = { params: Promise<{ segments?: string[] }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  const { segments = [] } = await ctx.params;
  if (segments.length === 0 || segments[0] === "features") {
    return getFeatureRegistry();
  }
  const tail = segments.map(encodeURIComponent).join("/");
  return proxyToAuthUpstream(request, `/api/vision/events/${tail}`);
}

export async function POST(request: NextRequest, ctx: Ctx) {
  const { segments = [] } = await ctx.params;
  if (segments.length === 0 || segments[0] === "features") {
    return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
  }
  const tail = segments.map(encodeURIComponent).join("/");
  return proxyToAuthUpstream(request, `/api/vision/events/${tail}`);
}
