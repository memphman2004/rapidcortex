import type { NextRequest } from "next/server";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

type Ctx = { params: Promise<{ incidentId: string }> };

export async function GET(request: NextRequest, context: Ctx) {
  const { incidentId } = await context.params;
  return proxyToAuthUpstream(
    request,
    `/api/comms-intel/incidents/${encodeURIComponent(incidentId)}/context-card`,
  );
}
