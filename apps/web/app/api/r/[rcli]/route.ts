import type { NextRequest } from "next/server";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

type RouteParams = { params: Promise<{ rcli: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { rcli } = await params;
  return proxyToAuthUpstream(request, `/api/r/${encodeURIComponent(rcli.trim().toUpperCase())}`, {
    allowAnonymous: true,
  });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { rcli } = await params;
  return proxyToAuthUpstream(request, `/api/r/${encodeURIComponent(rcli.trim().toUpperCase())}`, {
    allowAnonymous: true,
  });
}
