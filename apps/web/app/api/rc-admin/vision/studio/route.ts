import { NextResponse } from "next/server";
import { isRcStaff } from "rapid-cortex-security";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { canEnterProduction, reviewDiscoveryCandidate, startTrainingJob, type DiscoveryCandidate } from "@/lib/rapid-vision/model-studio";

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
    datasetReady?: boolean;
    phase?: "DRAFT" | "TRAINING" | "EVALUATION" | "REVIEW" | "APPROVED" | "SHADOW" | "PRODUCTION" | "RETIRED" | "REJECTED";
  } | null;

  if (body?.action === "review-candidate" && body.candidate && body.decision) {
    const result = reviewDiscoveryCandidate(body.candidate, body.decision);
    return NextResponse.json({ ...result, actor: user.userId, at: new Date().toISOString() });
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
