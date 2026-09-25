import type { NextRequest } from "next/server";
import { salesAutomationRouteGate } from "@/lib/server/sales-automation-route-gate";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

type Ctx = { params: Promise<{ segments?: string[] }> };

function upstreamPath(segments: string[] | undefined): string {
  const tail = segments?.length ? `/${segments.join("/")}` : "";
  return `/api/rapid-iq/sales-automation${tail}`;
}

export async function GET(request: NextRequest, ctx: Ctx) {
  const denied = await salesAutomationRouteGate();
  if (denied) return denied;
  const { segments } = await ctx.params;
  return proxyToAuthUpstream(request, upstreamPath(segments));
}

export async function POST(request: NextRequest, ctx: Ctx) {
  const denied = await salesAutomationRouteGate();
  if (denied) return denied;
  const { segments } = await ctx.params;
  return proxyToAuthUpstream(request, upstreamPath(segments));
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const denied = await salesAutomationRouteGate();
  if (denied) return denied;
  const { segments } = await ctx.params;
  return proxyToAuthUpstream(request, upstreamPath(segments));
}

export async function PUT(request: NextRequest, ctx: Ctx) {
  const denied = await salesAutomationRouteGate();
  if (denied) return denied;
  const { segments } = await ctx.params;
  return proxyToAuthUpstream(request, upstreamPath(segments));
}
