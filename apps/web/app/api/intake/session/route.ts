import type { NextRequest } from "next/server";
import { withFeatureContract } from "@/lib/rapid-cortex/contract-response";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

export async function POST(request: NextRequest) {
  return withFeatureContract("ai_assisted_intake", async () =>
    proxyToAuthUpstream(request, "/api/intake/session"),
  );
}
