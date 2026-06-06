import type { NextRequest } from "next/server";
import { withFeatureContract } from "@/lib/rapid-cortex/contract-response";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

type Ctx = { params: Promise<{ segments?: string[] }> };

function resolveFeatureId(segments: string[]): string {
  if (segments[0] === "alerts") return "alert_correlation";
  if (segments[0] === "escalation") return "escalation_engine";
  if (segments[0] === "on-call") return "on_call_routing";
  if (segments[0] === "slo") return "slo_dashboards";
  return "monitoring_integrations";
}

async function handle(request: NextRequest, ctx: Ctx) {
  const { segments = [] } = await ctx.params;
  const endpoint = `/api/reliability/${segments.join("/")}`.replace(/\/$/, "") || "/api/reliability";
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

export async function DELETE(request: NextRequest, ctx: Ctx) {
  return handle(request, ctx);
}
