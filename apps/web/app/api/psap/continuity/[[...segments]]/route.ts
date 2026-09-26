import type { NextRequest } from "next/server";
import { canManageRcsCall, canViewRcsMonitor } from "@/lib/rcs/rcs-authz";
import { rcsForbidden, requireRcsUser } from "@/lib/rcs/rcs-server-access";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

/**
 * Legacy live-web alias. RCS Monitor used to poll `/api/psap/continuity`;
 * the canonical handler is `/api/rcs/calls` on stack 2.
 */

type Ctx = { params: Promise<{ segments?: string[] }> };

async function proxyToRcs(request: NextRequest, ctx: Ctx) {
  const { segments = [] } = await ctx.params;
  const tail = segments.map(encodeURIComponent).join("/");
  const path = `/api/rcs/calls${tail ? `/${tail}` : ""}`;
  return proxyToAuthUpstream(request, path);
}

export async function GET(request: NextRequest, ctx: Ctx) {
  const result = await requireRcsUser();
  if ("error" in result) return result.error;
  if (!canViewRcsMonitor(result.user, result.user.agencyId)) return rcsForbidden();
  return proxyToRcs(request, ctx);
}

export async function POST(request: NextRequest, ctx: Ctx) {
  const result = await requireRcsUser();
  if ("error" in result) return result.error;
  if (!canManageRcsCall(result.user, result.user.agencyId)) return rcsForbidden();
  return proxyToRcs(request, ctx);
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const result = await requireRcsUser();
  if ("error" in result) return result.error;
  if (!canManageRcsCall(result.user, result.user.agencyId)) return rcsForbidden();
  return proxyToRcs(request, ctx);
}
