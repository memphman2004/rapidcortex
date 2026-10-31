import { NextResponse } from "next/server";
import { isRcStaff } from "rapid-cortex-security";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { intelligenceProviderStatus, refuseFrameExport, type StudioDiagnostic } from "@/lib/rapid-vision/intelligence-provider";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  assembleDatasetVersion,
  confirmBatchPlan,
  datasetGapReport,
  prepareSageMakerTraining,
  submitDatasetForTraining,
  applyReviewDecision,
  FIREARM_PILOT_BATCH_ID,
  type ReviewDecision,
  type StudioBox,
} from "@/lib/rapid-vision/studio-dataset";
import { addReviewComment, adjustStudioBox, clearStudioBox, parseStudioBox, verifyMediaRights, verifyTrainingLabel, appendAudit, type RightsInput } from "@/lib/rapid-vision/studio-review-gates";
import { hasActiveBatchJob, listDatasetVersions, listStudioReviews, saveDatasetVersion, saveStudioReview } from "@/lib/rapid-vision/studio-review-store";
import { loadStudioPreview } from "@/lib/rapid-vision/studio-preview";

export const dynamic = "force-dynamic";

async function authorize() {
  const user = await getDashboardSessionUser();
  if (!user || !isRcStaff(user.role)) return null;
  return user;
}

function readDiagnostic(): StudioDiagnostic | null {
  try {
    const file = path.join(process.cwd(), "data/openai-studio-status.json");
    return JSON.parse(readFileSync(file, "utf8")) as StudioDiagnostic;
  } catch {
    return null;
  }
}

function reviewerName(user: { email?: string; userId: string }): string {
  return user.email?.trim() || user.userId;
}

export async function GET(request: Request) {
  const user = await authorize();
  if (!user) return NextResponse.json({ error: "Only RC Admin, RC IT, and RC Superadmin can view intelligence providers." }, { status: 403 });
  const previewId = new URL(request.url).searchParams.get("preview");
  let reviews: Awaited<ReturnType<typeof listStudioReviews>> = [];
  let datasets: Awaited<ReturnType<typeof listDatasetVersions>> = [];
  let storage: "dynamodb" | "unavailable" = "unavailable";
  try {
    reviews = await listStudioReviews();
    datasets = await listDatasetVersions();
    storage = "dynamodb";
  } catch {
    storage = "unavailable";
  }
  if (previewId) {
    const record = reviews.find((item) => item.id === previewId);
    if (!record) return NextResponse.json({ error: "That review record was not found." }, { status: 404 });
    try {
      const preview = await loadStudioPreview(record);
      if (preview.kind === "redirect") return NextResponse.redirect(preview.url);
      if (preview.kind === "bytes") {
        return new NextResponse(Buffer.from(preview.bytes), {
          headers: { "content-type": preview.contentType, "cache-control": "private, no-store" },
        });
      }
      return NextResponse.json({ error: preview.reason }, { status: 404 });
    } catch {
      return NextResponse.json({ error: "The preview could not be read." }, { status: 503 });
    }
  }
  const verified = reviews.filter((item) => item.trainingLabel).length;
  const awaiting = reviews.filter((item) => item.status === "REVIEW_REQUIRED" || item.status === "CORRECTION_REQUESTED").length;
  const latest = datasets.at(-1) ?? null;
  return NextResponse.json({
    ...intelligenceProviderStatus(readDiagnostic()),
    storage,
    reviews,
    datasets,
    gaps: datasetGapReport(reviews),
    readiness: {
      candidates: reviews.length,
      labelsVerified: verified,
      awaitingReview: awaiting,
      training: prepareSageMakerTraining({ version: latest, costApproved: false }),
    },
    liveDetection: "disabled",
    batchEnabled: process.env.STUDIO_BATCH_ENABLED === "1",
    pilotBatchId: FIREARM_PILOT_BATCH_ID,
  });
}

type PostBody = {
  action?: string;
  id?: string;
  decision?: ReviewDecision;
  note?: string;
  category?: string;
  count?: number;
  confirmed?: boolean;
  rights?: RightsInput;
  box?: StudioBox | null;
  identifiable?: boolean;
  costApproved?: boolean;
};

export async function POST(request: Request) {
  const user = await authorize();
  if (!user) return NextResponse.json({ error: "Only RC Admin, RC IT, and RC Superadmin can use intelligence providers." }, { status: 403 });
  const body = (await request.json().catch(() => null)) as PostBody | null;
  const reviewer = reviewerName(user);
  const now = new Date().toISOString();

  if (body?.action === "plan-batch" || body?.action === "confirm-batch") {
    let activeJob = false;
    let spent = 0;
    try {
      activeJob = await hasActiveBatchJob();
      const reviews = await listStudioReviews();
      const pilotCount = reviews.filter((item) => item.batchId === FIREARM_PILOT_BATCH_ID).length;
      if (pilotCount > 0) {
        return NextResponse.json({
          ok: false,
          generated: false,
          estimatedUsd: 0.4,
          stored: pilotCount,
          reason: "The 10-image firearm pilot is already stored. No second batch was requested.",
          liveDetection: "disabled",
        });
      }
    } catch {
      activeJob = false;
    }
    const plan = confirmBatchPlan({
      category: body.category || "firearm_like",
      count: Number(body.count ?? 10),
      spentUsd: spent,
      capUsd: Number(process.env.STUDIO_OPENAI_SPEND_CAP_USD ?? "5"),
      batchEnabled: process.env.STUDIO_BATCH_ENABLED === "1",
      confirmed: body.action === "confirm-batch" && body.confirmed === true,
      activeJob,
    });
    return NextResponse.json({ ...plan, generated: false, liveDetection: "disabled" });
  }

  if (body?.action === "assemble-dataset") {
    try {
      const reviews = await listStudioReviews();
      const existing = await listDatasetVersions();
      const built = assembleDatasetVersion(reviews, { reviewer, now, version: existing.length + 1 });
      if (!built.ok) return NextResponse.json(built);
      await saveDatasetVersion(built.version);
      return NextResponse.json({ ...built, stored: true, launched: false, liveDetection: "disabled" });
    } catch {
      return NextResponse.json({ ok: false, reason: "The dataset version was not stored." }, { status: 503 });
    }
  }

  if (body?.action === "prepare-training" || body?.action === "submit-training") {
    try {
      const reviews = await listStudioReviews();
      const versions = await listDatasetVersions();
      const refusal = submitDatasetForTraining(reviews);
      const prepared = prepareSageMakerTraining({ version: versions.at(-1) ?? null, costApproved: body.costApproved === true });
      return NextResponse.json({ ...refusal, ...prepared, launched: false, liveDetection: "disabled" });
    } catch {
      return NextResponse.json({ ok: false, launched: false, reason: "The review table could not be read. Training was not started." });
    }
  }

  if (!body?.id) return NextResponse.json(refuseFrameExport());

  try {
    const reviews = await listStudioReviews();
    const current = reviews.find((item) => item.id === body.id);
    if (!current) return NextResponse.json({ ok: false, reason: "That review record was not found." }, { status: 404 });

    const parsedBox = body.action === "correct-box" && body.box !== null ? parseStudioBox(body.box) : null;
    const result =
      body.action === "verify-rights"
        ? verifyMediaRights(current, body.rights ?? {}, reviewer, now)
        : body.action === "verify-label"
          ? verifyTrainingLabel(current, reviewer, now, typeof body.note === "string" ? body.note : undefined, {
              identifiable: body.identifiable === false ? false : undefined,
            })
          : body.action === "correct-box"
            ? body.box === null
              ? clearStudioBox(current, reviewer, now)
              : parsedBox
                ? adjustStudioBox(current, parsedBox, reviewer, now)
                : { ok: false as const, reason: "The box must sit inside the image. Coordinates are 0 to 1." }
            : body.action === "comment"
              ? addReviewComment(current, body.note ?? "", reviewer, now)
              : body.action === "review-decision" && body.decision
                ? applyReviewDecision(current, body.decision, body.note)
                : null;
    if (!result) return NextResponse.json(refuseFrameExport());
    if (!result.ok) return NextResponse.json(result);
    const record =
      body.action === "review-decision"
        ? appendAudit(result.record, { at: now, reviewer, action: body.decision || "review", note: body.note })
        : result.record;
    await saveStudioReview(record);
    return NextResponse.json({ ok: true, record, stored: true, liveDetection: "disabled" });
  } catch {
    return NextResponse.json({ ok: false, reason: "The review record was not saved." }, { status: 503 });
  }
}
