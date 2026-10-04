import { NextRequest, NextResponse } from "next/server";
import { flattenPipelineLeads } from "@/components/rc-admin/leads/leads-api";
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

  const data: unknown = await upstream.json().catch(() => ({}));
  let leads = flattenPipelineLeads(data).filter((l) => l.pipelineStage === "WON");

  if (earningsScopedToSelf(user)) {
    const email = (user.email ?? "").toLowerCase();
    leads = leads.filter(
      (l) => (l.assignedTo ?? l.assignee ?? "").toLowerCase() === email,
    );
  }

  return NextResponse.json({ leads });
}
