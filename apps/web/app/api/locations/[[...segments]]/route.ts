import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

/**
 * Live dispatcher still polls `/api/locations/detection-screening`.
 * Other `/api/locations/*` aliases map onto ALS `/api/location/*`.
 */

type Ctx = { params: Promise<{ segments?: string[] }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  const { segments = [] } = await ctx.params;
  if (segments[0] === "detection-screening") {
    return NextResponse.json({ enabled: false, matches: [] });
  }
  const tail = segments.map(encodeURIComponent).join("/");
  const path = tail ? `/api/location/${tail}` : "/api/location/geocode";
  return proxyToAuthUpstream(request, path);
}

export async function POST(request: NextRequest, ctx: Ctx) {
  const { segments = [] } = await ctx.params;
  const tail = segments.map(encodeURIComponent).join("/");
  if (!tail) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return proxyToAuthUpstream(request, `/api/location/${tail}`);
}
