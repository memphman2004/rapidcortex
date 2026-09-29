import { NextResponse } from "next/server";
import { canAccessNexiQWorkspace } from "rapid-cortex-shared";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isNexiQPipelineUiEnabled } from "@/lib/runtime-flags";

export async function rapidIqPipelineRouteGate(): Promise<NextResponse | null> {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessNexiQWorkspace(user.role) || !isNexiQPipelineUiEnabled()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}
