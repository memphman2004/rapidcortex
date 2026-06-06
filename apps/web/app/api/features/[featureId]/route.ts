import { NextResponse } from "next/server";
import { resolveAgencyConfigForUser } from "@/lib/rapid-cortex/agency-config-resolver";
import { getFeatureAvailability, isFeatureEnabledForAgency } from "@/lib/rapid-cortex/entitlements";
import { getRapidCortexFeatureById } from "@/lib/rapid-cortex/features";
import { requireApiUser } from "@/lib/rapid-cortex/server-auth";

type Ctx = { params: Promise<{ featureId: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const user = await requireApiUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { featureId } = await ctx.params;
  const feature = getRapidCortexFeatureById(featureId);
  if (!feature) {
    return NextResponse.json({ error: "Feature not found" }, { status: 404 });
  }

  const agencyConfig = resolveAgencyConfigForUser(user);
  return NextResponse.json({
    feature,
    availability: getFeatureAvailability(agencyConfig.plan, featureId),
    enabledForAgency: isFeatureEnabledForAgency(agencyConfig, featureId),
    agencyConfig,
  });
}
