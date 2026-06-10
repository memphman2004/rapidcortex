import type { NextRequest } from "next/server";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

type Ctx = { params: Promise<{ incidentId: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  const { incidentId } = await ctx.params;
  const venueCode = request.nextUrl.searchParams.get("venueCode")?.trim();
  const query = venueCode ? `?venueCode=${encodeURIComponent(venueCode)}` : "";
  return proxyToAuthUpstream(request, `/api/venue/incidents/${encodeURIComponent(incidentId)}${query}`);
}
