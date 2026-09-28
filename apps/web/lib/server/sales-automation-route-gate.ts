import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { canAccessSalesAutomation, canManageSalesAutomation } from "rapid-cortex-shared";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isSalesAutomationUiEnabled } from "@/lib/runtime-flags";

export async function salesAutomationRouteGate(): Promise<NextResponse | null> {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessSalesAutomation(user.role) || !isSalesAutomationUiEnabled()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

/** True when the path/method mutates campaign copy, approval, suppress, or Outlook. */
export function salesAutomationPathRequiresManage(
  method: string,
  segments: string[] | undefined,
): boolean {
  const m = method.toUpperCase();
  if (m === "PATCH" || m === "PUT") return true;
  if (m !== "POST" && m !== "GET") return false;
  const path = (segments ?? []).join("/");
  if (path.includes("approve") || path.includes("suppress")) return true;
  if (path.includes("outlook/connect") || path.includes("outlook/disconnect")) return true;
  if (path.includes("outlook/callback")) return true;
  // GET outlook/connect starts OAuth — manage-only
  if (m === "GET" && path.includes("outlook/connect")) return true;
  return false;
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
