import type { NextRequest } from "next/server";
import { canViewFloorHealth } from "@/lib/rcs/rcs-authz";
import { rcsForbidden, requireRcsUser } from "@/lib/rcs/rcs-server-access";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

export async function GET(request: NextRequest) {
  const result = await requireRcsUser();
  if ("error" in result) return result.error;
  if (!canViewFloorHealth(result.user, result.user.agencyId)) return rcsForbidden();
  return proxyToAuthUpstream(request, "/api/rcs/floor-health");
}
