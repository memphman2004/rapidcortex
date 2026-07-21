import type { NextRequest } from "next/server";
import { canManageRcsCall } from "@/lib/rcs/rcs-authz";
import { rcsForbidden, requireRcsUser } from "@/lib/rcs/rcs-server-access";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

type Ctx = { params: Promise<{ callId: string }> };

/** Close out an RCS call with a closure reason (dispatcher normal close or supervisor override). */
export async function POST(request: NextRequest, ctx: Ctx) {
  const { callId } = await ctx.params;
  const result = await requireRcsUser();
  if ("error" in result) return result.error;
  if (!canManageRcsCall(result.user, result.user.agencyId)) return rcsForbidden();
  return proxyToAuthUpstream(request, `/api/rcs/calls/${encodeURIComponent(callId)}/close`);
}
