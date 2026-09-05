import type { NextRequest } from "next/server";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

export async function GET(request: NextRequest) {
  return proxyToAuthUpstream(request, "/api/campus/automation-rules");
}

export async function PUT(request: NextRequest) {
  return proxyToAuthUpstream(request, "/api/campus/automation-rules");
}
