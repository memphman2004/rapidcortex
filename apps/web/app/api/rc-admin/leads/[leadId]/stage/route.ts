import { NextRequest, NextResponse } from "next/server";
import { canAccessSalesLeadsCrm } from "rapid-cortex-shared";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isSalesLeadsUiEnabled } from "@/lib/runtime-flags";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

type Ctx = { params: Promise<{ leadId: string }> };

/**
 * Bridge map: current PipelineStage tokens → legacy enum values the stale
 * Lambda bundle's Zod schema accepts. Remove once a clean SAM deploy lands
 * and the Lambda bundle is rebuilt with the updated packages/shared schema.
 *
 * Read path: normalizePipelineStage() in packages/shared maps the stored
 * legacy tokens back to their current equivalents (e.g. PILOT → DEMO_COMPLETED).
 */
const STAGE_BRIDGE: Record<string, string> = {
  NEW: "NEW_LEAD",
  ENGAGED: "CONTACTED",
  DEMO_COMPLETED: "PILOT",
  PROCUREMENT: "PROPOSAL",
  CONTRACTING: "NEGOTIATION",
};

export async function PATCH(request: NextRequest, context: Ctx) {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessSalesLeadsCrm(user.role) || !isSalesLeadsUiEnabled()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { leadId } = await context.params;
  if (!leadId?.trim()) return NextResponse.json({ error: "leadId is required" }, { status: 400 });

  // Normalize stage value for the stale Lambda bundle.
  // NOTE: request.json() consumes the body stream, so we must always pass
  // bodyOverride after a successful parse — even if no remapping is needed.
  let bodyOverride: string | undefined;
  try {
    const raw = (await request.json()) as Record<string, unknown>;
    if (typeof raw?.stage === "string") {
      const mappedStage = STAGE_BRIDGE[raw.stage] ?? raw.stage;
      bodyOverride = JSON.stringify({ ...raw, stage: mappedStage });
    }
  } catch {
    // Non-JSON or empty body — stream not consumed; proxy forwards as-is.
  }

  return proxyToAuthUpstream(request, `/api/rc-admin/leads/${encodeURIComponent(leadId)}/stage`, {
    ...(bodyOverride !== undefined ? { bodyOverride } : {}),
  });
}
