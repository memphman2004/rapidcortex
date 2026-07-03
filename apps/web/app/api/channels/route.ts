import type { NextRequest } from "next/server";
import { withFeatureContract } from "@/lib/rapid-cortex/contract-response";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

export async function GET(request: NextRequest) {
  return withFeatureContract("channel_talk_group_monitoring", async () =>
    proxyToAuthUpstream(request, "/api/channels"),
  );
}

export async function POST(request: NextRequest) {
  return withFeatureContract("channel_talk_group_monitoring", async () =>
    proxyToAuthUpstream(request, "/api/channels"),
  );
}
