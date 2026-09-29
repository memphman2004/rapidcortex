import { NextResponse } from "next/server";
import { canAccessNexiQWorkspace } from "rapid-cortex-shared";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isNexiQUiEnabled } from "@/lib/runtime-flags";

export async function rapidIqRouteGate(): Promise<NextResponse | null> {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessNexiQWorkspace(user.role) || !isNexiQUiEnabled()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}
