import { NextRequest, NextResponse } from "next/server";
import { createActivityReportBodySchema } from "rapid-cortex-shared";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { canViewPipeline } from "@/lib/sales/sales-authz";
import { listActivityReports, putActivityReport } from "@/lib/sales/sales-store";

export async function GET() {
  const user = await getDashboardSessionUser();
  if (!user || !canViewPipeline(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const email = user.email ?? user.userId;
  const items = await listActivityReports(email);
  return NextResponse.json({ items });
}

export async function POST(request: NextRequest) {
  const user = await getDashboardSessionUser();
  if (!user || !canViewPipeline(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const parsed = createActivityReportBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }
  const email = user.email ?? user.userId;
  const item = {
    ...parsed.data,
    contractorEmail: email,
    submittedAt: new Date().toISOString(),
  };
  // Append-only semantics: put replaces same weekOf entry but never UpdateItem API
  await putActivityReport(email, item);
  return NextResponse.json({ ok: true, item });
}
