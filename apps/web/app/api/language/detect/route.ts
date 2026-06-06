import type { NextRequest } from "next/server";
import { withFeatureContract } from "@/lib/rapid-cortex/contract-response";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

export async function POST(request: NextRequest) {
  return withFeatureContract("language_auto_detection", async () =>
    proxyToAuthUpstream(request, "/api/language/detect"),
  );
}
