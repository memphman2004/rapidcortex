import { NextResponse } from "next/server";
import { resolveAgencyConfigForUser } from "@/lib/rapid-cortex/agency-config-resolver";
import { isFeatureEnabledForAgency } from "@/lib/rapid-cortex/entitlements";
import { RAPID_CORTEX_FEATURES } from "@/lib/rapid-cortex/features";
import { requireApiUser } from "@/lib/rapid-cortex/server-auth";

export async function GET() {
  const user = await requireApiUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const agencyConfig = resolveAgencyConfigForUser(user);
  const features = RAPID_CORTEX_FEATURES.map((feature) => ({
    ...feature,
    enabledForAgency: isFeatureEnabledForAgency(agencyConfig, feature.id),
  }));
  return NextResponse.json({ agencyConfig, features });
}
