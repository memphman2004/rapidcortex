import type { NextRequest } from "next/server";
import { canManageRcsCall, canViewRcsMonitor } from "@/lib/rcs/rcs-authz";
import { rcsForbidden, requireRcsUser } from "@/lib/rcs/rcs-server-access";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

/** List active RCS-monitored calls for the caller's agency. */
export async function GET(request: NextRequest) {
  const result = await requireRcsUser();
  if ("error" in result) return result.error;
  if (!canViewRcsMonitor(result.user, result.user.agencyId)) return rcsForbidden();
  return proxyToAuthUpstream(request, "/api/rcs/calls");
}

/** Start a new RCS continuity session for an active call. */
export async function POST(request: NextRequest) {
  const result = await requireRcsUser();
  if ("error" in result) return result.error;
  if (!canManageRcsCall(result.user, result.user.agencyId)) return rcsForbidden();
  return proxyToAuthUpstream(request, "/api/rcs/calls");
}
