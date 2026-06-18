import type { NextRequest } from "next/server";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";
import {
  requireVenueOnboardingApi,
  upstreamQuery,
} from "@/lib/onboarding/onboarding-bff-auth";

type Ctx = { params: Promise<{ orgCode: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  const { orgCode } = await ctx.params;
  const auth = await requireVenueOnboardingApi(orgCode);
  if (!auth.ok) return auth.response;

  return proxyToAuthUpstream(
    request,
    `/api/venue/${encodeURIComponent(orgCode)}/onboarding/intake${upstreamQuery(request, auth.user.agencyId ?? undefined)}`,
  );
}

export async function PUT(request: NextRequest, ctx: Ctx) {
  const { orgCode } = await ctx.params;
  const auth = await requireVenueOnboardingApi(orgCode);
  if (!auth.ok) return auth.response;

  return proxyToAuthUpstream(
    request,
    `/api/venue/${encodeURIComponent(orgCode)}/onboarding/intake${upstreamQuery(request, auth.user.agencyId ?? undefined)}`,
  );
}
