import { NextRequest, NextResponse } from "next/server";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isRcAdmin, isRcSuperAdmin } from "rapid-cortex-security";

type Ctx = { params: Promise<{ agencyId: string }> };

async function gate() {
  const user = await getDashboardSessionUser();
  if (!user || (!isRcSuperAdmin(user.role) && !isRcAdmin(user.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export async function GET(request: NextRequest, ctx: Ctx) {
  const denied = await gate();
  if (denied) return denied;
  const { agencyId } = await ctx.params;
  return proxyToAuthUpstream(
    request,
    `/api/rc-admin/agencies/${encodeURIComponent(agencyId)}/escalation-relationship`,
  );
}

export async function PUT(request: NextRequest, ctx: Ctx) {
  const denied = await gate();
  if (denied) return denied;
  const { agencyId } = await ctx.params;
  return proxyToAuthUpstream(
    request,
    `/api/rc-admin/agencies/${encodeURIComponent(agencyId)}/escalation-relationship`,
  );
}
