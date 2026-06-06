import type { NextRequest } from "next/server";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

type RouteParams = { params: Promise<{ agencyId: string; segments?: string[] }> };

function upstreamPath(agencyId: string, segments?: string[]): string {
  const base = `/api/admin/tenants/${encodeURIComponent(agencyId)}/locations`;
  if (!segments?.length) return base;
  return `${base}/${segments.map((s) => encodeURIComponent(s)).join("/")}`;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { agencyId, segments } = await params;
  return proxyToAuthUpstream(request, upstreamPath(agencyId, segments));
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { agencyId, segments } = await params;
  return proxyToAuthUpstream(request, upstreamPath(agencyId, segments));
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { agencyId, segments } = await params;
  return proxyToAuthUpstream(request, upstreamPath(agencyId, segments));
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { agencyId, segments } = await params;
  return proxyToAuthUpstream(request, upstreamPath(agencyId, segments));
}
