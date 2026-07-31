import type { NextRequest } from "next/server";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

export async function GET(request: NextRequest) {
  return proxyToAuthUpstream(request, "/api/campus/clery/entries");
}

export async function POST(request: NextRequest) {
  return proxyToAuthUpstream(request, "/api/campus/clery/entries");
}
