import type { NextRequest } from "next/server";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

export async function POST(request: NextRequest) {
  return proxyToAuthUpstream(request, "/api/stream/viewer-token");
}
