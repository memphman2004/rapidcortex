import type { NextRequest } from "next/server";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const startDate = url.searchParams.get("startDate");
  const qs = startDate ? `?startDate=${encodeURIComponent(startDate)}` : "";
  return proxyToAuthUpstream(request, `/api/staffing/forecast${qs}`);
}
