import { NextResponse } from "next/server";
import { canAccessSalesAutomation } from "rapid-cortex-shared";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isSalesAutomationUiEnabled } from "@/lib/runtime-flags";

export async function salesAutomationRouteGate(): Promise<NextResponse | null> {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessSalesAutomation(user.role) || !isSalesAutomationUiEnabled()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}
