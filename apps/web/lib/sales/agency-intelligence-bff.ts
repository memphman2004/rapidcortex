import { NextResponse } from "next/server";
import { canAccessPsapProspectsCrm } from "rapid-cortex-shared";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isPsapProspectsUiEnabled } from "@/lib/runtime-flags";

export async function agencyIntelligenceBffGate(): Promise<NextResponse | null> {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessPsapProspectsCrm(user.role) || !isPsapProspectsUiEnabled()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}
