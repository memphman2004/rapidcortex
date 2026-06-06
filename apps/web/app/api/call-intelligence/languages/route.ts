import type { NextRequest } from "next/server";
import { withFeatureContract } from "@/lib/rapid-cortex/contract-response";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

export async function GET(request: NextRequest) {
  return withFeatureContract("live_translation", async () =>
    proxyToAuthUpstream(request, "/api/call-intelligence/languages"),
  );
}
