import { NextRequest, NextResponse } from "next/server";
import { createRoiSessionBodySchema } from "rapid-cortex-shared";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { canViewPipeline } from "@/lib/sales/sales-authz";
import { putRoiSession } from "@/lib/sales/sales-store";

function token(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 10);
}

export async function POST(request: NextRequest) {
  const user = await getDashboardSessionUser();
  if (!user || !canViewPipeline(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createRoiSessionBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }

  const roiToken = token();
  const now = new Date().toISOString();
  const ttl = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
  await putRoiSession({
    roiToken,
    inputs: parsed.data.inputs,
    createdByEmail: user.email ?? user.userId,
    createdAt: now,
    ttl,
  });

  return NextResponse.json({
    roiToken,
    url: `/roi/${roiToken}`,
  });
}
