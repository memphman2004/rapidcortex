import { NextResponse } from "next/server";
import { resolveAgencyConfigForUser } from "@/lib/rapid-cortex/agency-config-resolver";
import { getAllFeatureReadiness } from "@/lib/rapid-cortex/readiness";
import { requireApiUser } from "@/lib/rapid-cortex/server-auth";

export async function GET() {
  const user = await requireApiUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const agency = resolveAgencyConfigForUser(user);
  return NextResponse.json({ agencyConfig: agency, items: getAllFeatureReadiness(agency.plan, agency) });
}
