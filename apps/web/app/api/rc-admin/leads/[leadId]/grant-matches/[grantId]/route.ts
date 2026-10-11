import { NextRequest, NextResponse } from "next/server";
import { canAccessSalesLeadsCrm, patchGrantMatchOutcomeBodySchema } from "rapid-cortex-shared";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

/**
 * Patch grant-match outcome. Upstream may not exist yet — treat 404 as soft no-op
 * so the CRM Grants tab does not surface hard failures.
 */
export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ leadId: string; grantId: string }> },
) {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessSalesLeadsCrm(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { leadId, grantId } = await ctx.params;
  if (!leadId?.trim() || !grantId?.trim()) {
    return NextResponse.json({ error: "leadId and grantId are required" }, { status: 400 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = patchGrantMatchOutcomeBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const upstream = await proxyToAuthUpstream(
    request,
    `/api/rc-admin/leads/${encodeURIComponent(leadId)}/grant-matches/${encodeURIComponent(grantId)}`,
  );
  if (upstream.status === 404) {
    return NextResponse.json({
      ok: true,
      deferred: true,
      grantId,
      outcome: parsed.data.outcome,
    });
  }
  return upstream;
}
