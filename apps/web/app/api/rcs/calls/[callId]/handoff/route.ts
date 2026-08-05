import type { NextRequest } from "next/server";
import { canRequestSoftHandoff, canSupervisorOverride } from "@/lib/rcs/rcs-authz";
import { rcsForbidden, requireRcsUser } from "@/lib/rcs/rcs-server-access";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

type Ctx = { params: Promise<{ callId: string }> };

export async function POST(request: NextRequest, context: Ctx) {
  const result = await requireRcsUser();
  if ("error" in result) return result.error;
  if (!canRequestSoftHandoff(result.user, result.user.agencyId)) return rcsForbidden();
  const { callId } = await context.params;
  return proxyToAuthUpstream(request, `/api/rcs/calls/${encodeURIComponent(callId)}/handoff`);
}

export async function DELETE(request: NextRequest, context: Ctx) {
  const result = await requireRcsUser();
  if ("error" in result) return result.error;
  // Clear: requester or supervisor+ (API enforces finer rules).
  if (
    !canRequestSoftHandoff(result.user, result.user.agencyId) &&
    !canSupervisorOverride(result.user, result.user.agencyId)
  ) {
    return rcsForbidden();
  }
  const { callId } = await context.params;
  return proxyToAuthUpstream(request, `/api/rcs/calls/${encodeURIComponent(callId)}/handoff`);
}
