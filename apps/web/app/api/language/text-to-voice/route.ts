import type { NextRequest } from "next/server";
import { withFeatureContract } from "@/lib/rapid-cortex/contract-response";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

export async function POST(request: NextRequest) {
  return withFeatureContract("text_to_voice_support", async () =>
    proxyToAuthUpstream(request, "/api/language/text-to-voice"),
  );
}
