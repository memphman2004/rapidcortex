import { NextRequest, NextResponse } from "next/server";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { canViewPipeline } from "@/lib/sales/sales-authz";
import { TERRITORY_ROSTER } from "@/lib/sales/territory-roster";

export async function GET() {
  const user = await getDashboardSessionUser();
  if (!user || !canViewPipeline(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json({ items: TERRITORY_ROSTER });
}

export async function POST(_request: NextRequest) {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
