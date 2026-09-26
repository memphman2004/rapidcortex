import { NextRequest, NextResponse } from "next/server";
import { createRfpBodySchema } from "rapid-cortex-shared";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { canViewPipeline } from "@/lib/sales/sales-authz";
import { listRfps, putRfp } from "@/lib/sales/sales-store";

export async function GET() {
  const user = await getDashboardSessionUser();
  if (!user || !canViewPipeline(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const items = await listRfps();
  return NextResponse.json({ items });
}

export async function POST(request: NextRequest) {
  const user = await getDashboardSessionUser();
  if (!user || !canViewPipeline(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const parsed = createRfpBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }
  const now = new Date().toISOString();
  const rfpId = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  const item = {
    rfpId,
    ...parsed.data,
    stage: "IDENTIFIED",
    createdAt: now,
    updatedAt: now,
  };
  await putRfp(item);
  return NextResponse.json({ ok: true, item });
}
