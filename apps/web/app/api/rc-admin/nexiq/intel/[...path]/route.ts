import { NextRequest, NextResponse } from "next/server";
import { canAccessSalesLeadsCrm } from "rapid-cortex-shared";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isNexiqIntelUiEnabled } from "@/lib/runtime-flags";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

async function gate() {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessSalesLeadsCrm(user.role) || !isNexiqIntelUiEnabled()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

function upstreamPath(request: NextRequest, path: string[] | undefined): string {
  const suffix = (path ?? []).join("/");
  const base = "/api/rc-admin/nexiq/intel";
  const qs = request.nextUrl.search || "";
  return suffix ? `${base}/${suffix}${qs}` : `${base}${qs}`;
}

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> },
) {
  const denied = await gate();
  if (denied) return denied;
  const { path } = await ctx.params;
  return proxyToAuthUpstream(request, upstreamPath(request, path));
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> },
) {
  const denied = await gate();
  if (denied) return denied;
  const { path } = await ctx.params;
  return proxyToAuthUpstream(request, upstreamPath(request, path));
}

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> },
) {
  const denied = await gate();
  if (denied) return denied;
  const { path } = await ctx.params;
  return proxyToAuthUpstream(request, upstreamPath(request, path));
}

export async function DELETE(
  request: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> },
) {
  const denied = await gate();
  if (denied) return denied;
  const { path } = await ctx.params;
  return proxyToAuthUpstream(request, upstreamPath(request, path));
}
