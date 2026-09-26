import { NextRequest, NextResponse } from "next/server";
import { patchRfpBodySchema } from "rapid-cortex-shared";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { canViewPipeline } from "@/lib/sales/sales-authz";
import { deleteRfp, getRfp, putRfp } from "@/lib/sales/sales-store";

type Ctx = { params: Promise<{ rfpId: string }> };

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const user = await getDashboardSessionUser();
  if (!user || !canViewPipeline(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { rfpId } = await ctx.params;
  const existing = await getRfp(rfpId);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = await request.json().catch(() => null);
  const parsed = patchRfpBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }
  const item = {
    ...existing,
    ...parsed.data,
    updatedAt: new Date().toISOString(),
  };
  await putRfp(item);
  return NextResponse.json({ ok: true, item });
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  const user = await getDashboardSessionUser();
  if (!user || !canViewPipeline(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { rfpId } = await ctx.params;
  await deleteRfp(rfpId);
  return NextResponse.json({ ok: true });
}
