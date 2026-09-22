import type { NextRequest } from "next/server";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

type Ctx = { params: Promise<{ incidentId: string }> };

/**
 * Alias for Rapid Vision intelligence.
 * Live dispatcher still requests `/api/incidents/{id}/intelligence` (no `/vision/` segment).
 */
export async function GET(request: NextRequest, ctx: Ctx) {
  const { incidentId } = await ctx.params;
  return proxyToAuthUpstream(
    request,
    `/api/incidents/${encodeURIComponent(incidentId)}/vision/intelligence`,
  );
}
