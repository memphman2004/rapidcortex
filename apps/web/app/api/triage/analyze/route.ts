import type { NextRequest } from "next/server";
import { withFeatureContract } from "@/lib/rapid-cortex/contract-response";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

export async function POST(request: NextRequest) {
  return withFeatureContract("call_triage_workflows", async () =>
    proxyToAuthUpstream(request, "/api/triage/analyze"),
  );
}
