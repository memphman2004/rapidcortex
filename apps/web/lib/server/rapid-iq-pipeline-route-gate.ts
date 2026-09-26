import { NextResponse } from "next/server";
import { canAccessRapidIqWorkspace } from "rapid-cortex-shared";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isRapidIqPipelineUiEnabled } from "@/lib/runtime-flags";

export async function rapidIqPipelineRouteGate(): Promise<NextResponse | null> {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessRapidIqWorkspace(user.role) || !isRapidIqPipelineUiEnabled()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}
