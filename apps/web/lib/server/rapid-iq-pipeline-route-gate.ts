import { NextResponse } from "next/server";
import { canAccessRapidIq } from "rapid-cortex-shared";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isRapidIqPipelineUiEnabled } from "@/lib/runtime-flags";

export async function rapidIqPipelineRouteGate(): Promise<NextResponse | null> {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessRapidIq(user.role) || !isRapidIqPipelineUiEnabled()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}
