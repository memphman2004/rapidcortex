import type { NextRequest } from "next/server";
import { extractVenueCode } from "@/lib/auth/post-login-redirect";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

type Ctx = { params: Promise<{ agencyId: string }> };

/**
 * Dashboard client calls `/api/venue/{agencyId}/sections`.
 * Stack 5 only bound `GET /api/venue/{venueCode}/sections` (CRUD). The dashboard
 * twin `GET /api/venue/{agencyId}/sections` never registered on HttpApi (duplicate path).
 */
export async function GET(request: NextRequest, ctx: Ctx) {
  const { agencyId } = await ctx.params;
  const venueCode = extractVenueCode(agencyId);
  return proxyToAuthUpstream(
    request,
    `/api/venue/${encodeURIComponent(venueCode)}/sections`,
  );
}
