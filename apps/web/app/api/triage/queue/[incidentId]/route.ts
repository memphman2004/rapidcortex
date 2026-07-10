import type { NextRequest } from "next/server";
import { withTriageApiAccess } from "@/lib/rapid-cortex/contract-response";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

type Ctx = { params: Promise<{ incidentId: string }> };

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const { incidentId } = await ctx.params;
  return withTriageApiAccess(async () =>
    proxyToAuthUpstream(request, `/api/triage/queue/${encodeURIComponent(incidentId)}`),
  );
}
