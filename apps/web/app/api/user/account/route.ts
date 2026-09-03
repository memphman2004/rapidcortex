import type { NextRequest } from "next/server";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

export async function DELETE(request: NextRequest) {
  return proxyToAuthUpstream(request, "/api/user/account");
}
