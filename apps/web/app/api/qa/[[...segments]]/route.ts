import type { NextRequest } from "next/server";
import { withFeatureContract } from "@/lib/rapid-cortex/contract-response";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

type Ctx = { params: Promise<{ segments?: string[] }> };

function resolveFeatureId(segments: string[]): string {
  if (segments[0] === "coaching-note") return "coaching_notes";
  if (segments[0] === "scorecards") return "scorecards";
  return "qa_review_tools";
}

async function handle(request: NextRequest, ctx: Ctx) {
  const { segments = [] } = await ctx.params;
  const endpoint = `/api/qa/${segments.join("/")}`.replace(/\/$/, "") || "/api/qa";
  return withFeatureContract(resolveFeatureId(segments), async () =>
    proxyToAuthUpstream(request, endpoint),
  );
}

export async function GET(request: NextRequest, ctx: Ctx) {
  return handle(request, ctx);
}

export async function POST(request: NextRequest, ctx: Ctx) {
  return handle(request, ctx);
}

export async function PUT(request: NextRequest, ctx: Ctx) {
  return handle(request, ctx);
}
