import { NextRequest, NextResponse } from "next/server";
import { createAccountClaimBodySchema } from "rapid-cortex-shared";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { canViewPipeline } from "@/lib/sales/sales-authz";
import { deleteClaim, listClaims, putClaim } from "@/lib/sales/sales-store";

export async function GET() {
  const user = await getDashboardSessionUser();
  if (!user || !canViewPipeline(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const items = await listClaims();
  return NextResponse.json({ items, me: user.email ?? user.userId });
}

export async function POST(request: NextRequest) {
  const user = await getDashboardSessionUser();
  if (!user || !canViewPipeline(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const parsed = createAccountClaimBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }
  const email = user.email ?? user.userId;
  const item = {
    ...parsed.data,
    claimedByEmail: email,
    claimedByName: user.displayName ?? email,
    claimedAt: new Date().toISOString(),
  };
  // Soft claim — overwrite is allowed; never 403 on conflict
  await putClaim(item);
  return NextResponse.json({ ok: true, item });
}

export async function DELETE(request: NextRequest) {
  const user = await getDashboardSessionUser();
  if (!user || !canViewPipeline(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const agencySlug = request.nextUrl.searchParams.get("agencySlug") ?? "";
  if (!agencySlug) {
    return NextResponse.json({ error: "agencySlug required" }, { status: 400 });
  }
  const email = user.email ?? user.userId;
  const ok = await deleteClaim(agencySlug, email);
  return NextResponse.json({ ok });
}
