import { NextResponse } from "next/server";
import { canAccessRapidIqWorkspace } from "rapid-cortex-shared";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isRapidIqUiEnabled } from "@/lib/runtime-flags";

export async function rapidIqRouteGate(): Promise<NextResponse | null> {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessRapidIqWorkspace(user.role) || !isRapidIqUiEnabled()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}
