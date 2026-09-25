import { NextRequest, NextResponse } from "next/server";
import type { SalesLeadCrmRecord } from "rapid-cortex-shared";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { canViewEarnings, earningsScopedToSelf } from "@/lib/sales/sales-authz";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

export async function GET(request: NextRequest) {
  const user = await getDashboardSessionUser();
  if (!user || !canViewEarnings(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const upstream = await proxyToAuthUpstream(request, "/api/rc-admin/leads/pipeline");
  if (!upstream.ok) {
    return NextResponse.json({ leads: [] });
  }

  const data = (await upstream.json().catch(() => ({}))) as {
    leads?: SalesLeadCrmRecord[];
    stages?: Record<string, SalesLeadCrmRecord[]>;
  };
  let leads =
    data.leads ?? Object.values(data.stages ?? {}).flatMap((x) => x);

  leads = leads.filter((l) => l.pipelineStage === "WON");

  if (earningsScopedToSelf(user)) {
    const email = (user.email ?? "").toLowerCase();
    leads = leads.filter(
      (l) => (l.assignedTo ?? l.assignee ?? "").toLowerCase() === email,
    );
  }

  return NextResponse.json({ leads });
}
