import { NextRequest, NextResponse } from "next/server";
import { SalesTerritoryAssignmentsConfigSchema } from "rapid-cortex-shared";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { canManageSalesTerritories, canViewPipeline } from "@/lib/sales/sales-authz";
import {
  getTerritoryAssignments,
  putTerritoryAssignments,
} from "@/lib/sales/territory-assignments-store";
import { mergeTerritoryRoster } from "@/lib/sales/territory-roster";

export async function GET() {
  const user = await getDashboardSessionUser();
  if (!user || !canViewPipeline(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const assignments = await getTerritoryAssignments();
  return NextResponse.json({
    assignments,
    items: mergeTerritoryRoster(assignments),
  });
}

export async function PUT(request: NextRequest) {
  const user = await getDashboardSessionUser();
  if (!user || !canManageSalesTerritories(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = SalesTerritoryAssignmentsConfigSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid assignments payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const saved = await putTerritoryAssignments(parsed.data, {
    updatedByEmail: user.email,
  });
  return NextResponse.json({
    ok: true,
    assignments: saved,
    items: mergeTerritoryRoster(saved),
  });
}
