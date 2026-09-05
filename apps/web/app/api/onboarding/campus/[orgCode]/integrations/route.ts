import type { NextRequest } from "next/server";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";
import {
  requireCampusOnboardingApi,
  upstreamQuery,
} from "@/lib/onboarding/onboarding-bff-auth";

type Ctx = { params: Promise<{ orgCode: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  const { orgCode } = await ctx.params;
  const auth = await requireCampusOnboardingApi(orgCode);
  if (!auth.ok) return auth.response;

  return proxyToAuthUpstream(
    request,
    `/api/campus/${encodeURIComponent(orgCode)}/onboarding/integrations${upstreamQuery(request, auth.user.agencyId ?? undefined)}`,
  );
}

export async function PUT(request: NextRequest, ctx: Ctx) {
  const { orgCode } = await ctx.params;
  const auth = await requireCampusOnboardingApi(orgCode);
  if (!auth.ok) return auth.response;

  return proxyToAuthUpstream(
    request,
    `/api/campus/${encodeURIComponent(orgCode)}/onboarding/integrations${upstreamQuery(request, auth.user.agencyId ?? undefined)}`,
  );
}
