import { NextResponse } from "next/server";
import { isRcStaff } from "rapid-cortex-security";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { applyRightsDecision, assessTrainingRights, canEnterProduction, requestMediaImport, reviewDiscoveryCandidate, startTrainingJob, type DiscoveryCandidate, type RightsRecord } from "@/lib/rapid-vision/model-studio";

export const dynamic = "force-dynamic";

async function authorize() {
  const user = await getDashboardSessionUser();
  if (!user || !isRcStaff(user.role)) return null;
  return user;
}

export async function POST(request: Request) {
  const user = await authorize();
  if (!user) return NextResponse.json({ error: "Only RC Admin, RC IT, and RC Superadmin can use the model studio." }, { status: 403 });
  const body = (await request.json().catch(() => null)) as {
    action?: string;
    candidate?: DiscoveryCandidate;
    decision?: "approve" | "reject";
    rightsDecision?: "verify-license" | "approve-import" | "approve-training" | "reject";
    rights?: RightsRecord;
    datasetReady?: boolean;
    phase?: "DRAFT" | "TRAINING" | "EVALUATION" | "REVIEW" | "APPROVED" | "SHADOW" | "PRODUCTION" | "RETIRED" | "REJECTED";
  } | null;

  if (body?.action === "review-candidate" && body.candidate && body.decision) {
    const result = reviewDiscoveryCandidate(body.candidate, body.decision);
    return NextResponse.json({ ...result, actor: user.userId, at: new Date().toISOString() });
  }
  if (body?.action === "record-rights" && body.candidate && body.rightsDecision) {
    const assessed = assessTrainingRights({ license: body.candidate.license, source: body.candidate.source });
    if (assessed.status === "RESTRICTED" || assessed.status === "UNKNOWN") {
      return NextResponse.json({ ok: false, record: assessed, reason: assessed.evidence, actor: user.userId, stored: false, storage: "not_connected" });
    }
    const current = body.rights && body.rights.legalGuarantee === false ? { ...assessed, status: body.rights.status, reviewerId: body.rights.reviewerId, approvedAt: body.rights.approvedAt } : assessed;
    const result = applyRightsDecision({
      current,
      decision: body.rightsDecision,
      reviewerId: user.userId,
      at: new Date().toISOString(),
    });
    return NextResponse.json({ ...result, actor: user.userId, stored: false, storage: "not_connected" });
  }
  if (body?.action === "import-media" && body.rights) {
    const result = requestMediaImport({ status: body.rights.status, storageConnected: false });
    return NextResponse.json(result);
  }
  if (body?.action === "start-training") {
    const result = startTrainingJob({ datasetReady: Boolean(body.datasetReady), backendConnected: false });
    return NextResponse.json(result);
  }
  if (body?.action === "activate-production") {
    const result = canEnterProduction({
      phase: body.phase ?? "DRAFT",
      evaluationAccepted: false,
      artifactUri: null,
    });
    return NextResponse.json(result);
  }
  return NextResponse.json({ error: "Unknown studio action." }, { status: 400 });
}
