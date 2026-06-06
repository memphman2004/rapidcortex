import { NextResponse } from "next/server";
import { resolveAgencyConfigForUser, saveAgencyConfigForUser } from "@/lib/rapid-cortex/agency-config-resolver";
import type { AgencyFeatureConfig } from "@/lib/rapid-cortex/entitlements";
import { requireApiUser } from "@/lib/rapid-cortex/server-auth";

export async function GET() {
  const user = await requireApiUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ agencyConfig: resolveAgencyConfigForUser(user) });
}

export async function PATCH(request: Request) {
  const user = await requireApiUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Partial<AgencyFeatureConfig>;
  const next = saveAgencyConfigForUser(user, body);
  return NextResponse.json({
    agencyConfig: next,
    message:
      "Configuration updated in this server session. Persist in a backend agency profile service for production use.",
  });
}
