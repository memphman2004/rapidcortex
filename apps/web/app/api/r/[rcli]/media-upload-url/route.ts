import type { NextRequest } from "next/server";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

type RouteParams = { params: Promise<{ rcli: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { rcli } = await params;
  const upstream = `/api/r/${encodeURIComponent(rcli.trim().toUpperCase())}/media-upload-url`;
  return proxyToAuthUpstream(request, `${upstream}${request.nextUrl.search}`, {
    allowAnonymous: true,
  });
}
