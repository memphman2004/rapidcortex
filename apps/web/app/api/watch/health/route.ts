import { NextRequest } from "next/server";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

/** Public-safe health — no secrets. */
export async function GET(request: NextRequest) {
  return proxyToAuthUpstream(request, "/api/watch/health", { allowAnonymous: true });
}
