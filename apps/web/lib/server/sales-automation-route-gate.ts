import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { canAccessSalesAutomation, canManageSalesAutomation } from "rapid-cortex-shared";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isSalesAutomationUiEnabled } from "@/lib/runtime-flags";
import { salesAutomationPathRequiresManage } from "./sales-automation-path";

export { salesAutomationPathRequiresManage };

export async function salesAutomationRouteGate(): Promise<NextResponse | null> {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessSalesAutomation(user.role) || !isSalesAutomationUiEnabled()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export async function salesAutomationMutateGate(
  request: NextRequest,
  segments: string[] | undefined,
): Promise<NextResponse | null> {
  const denied = await salesAutomationRouteGate();
  if (denied) return denied;
  if (!salesAutomationPathRequiresManage(request.method, segments)) return null;
  const user = await getDashboardSessionUser();
  if (!user || !canManageSalesAutomation(user.role)) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only RC admins can approve or edit campaigns" },
      { status: 403 },
    );
  }
  return null;
}
