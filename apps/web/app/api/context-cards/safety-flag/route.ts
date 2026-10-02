import type { NextRequest } from "next/server";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

export async function PUT(request: NextRequest) {
  return proxyToAuthUpstream(request, "/api/context-cards/safety-flag");
}
