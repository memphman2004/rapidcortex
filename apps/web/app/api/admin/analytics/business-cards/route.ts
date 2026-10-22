import type { NextRequest } from "next/server";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

export function GET(request: NextRequest) {
  return proxyToAuthUpstream(request, "/api/admin/analytics/business-cards");
}
