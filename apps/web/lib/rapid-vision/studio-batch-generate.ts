/**
 * Stores one owned synthetic still image for a studio batch.
 * The image is not approved and live detection stays off.
 */
import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
import { STUDIO_ARTIFACT_BUCKET } from "./studio-dataset";
import { GENERATION_ATTEMPT_LIMIT, STILL_IMAGE_MODEL, attemptFitsSpend, generationRetryDelayMs, planStillBatch, progressSummary, studioSpendUsd, type BatchProgress, type BatchScene } from "./studio-batch";
import { reviewSyntheticUpload, validateStudioClip, validateStudioImage } from "./synthetic-generation";
import { claimScene, claimStudioBatch, listSkippedSceneIds, listStudioReviews, readBatchProgress, recordBatchOutcome, releaseScene, releaseStudioBatch, saveNewStudioReview, saveStudioReview, skipScene } from "./studio-review-store";

const REGION = process.env.AWS_REGION?.trim() || "us-east-1";
const SECRET_ID = "rapid-cortex/ai/openai";

export type GeneratedStill = {
  ok: true;
  generated: boolean;
  skipped?: boolean;
  batchId: string;
  createdId: string | null;
  remaining: number;
  estimatedUsd: number;
  approved: false;
  liveDetection: "disabled";
  progress: BatchProgress;
  reason: string;
};

export type GenerateStillResult = GeneratedStill | { ok: false; generated: false; reason: string; estimatedUsd: number; liveDetection: "disabled" };

function spendCap(): number {
  const cap = Number(process.env.STUDIO_OPENAI_SPEND_CAP_USD ?? "40");
  return Number.isFinite(cap) && cap > 0 ? cap : 40;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function openAiKey(): Promise<string> {
  const secrets = new SecretsManagerClient({ region: REGION });
  const secret = await secrets.send(new GetSecretValueCommand({ SecretId: SECRET_ID }));
  const parsed = JSON.parse(secret.SecretString ?? "{}") as { apiKey?: unknown };
  const apiKey = typeof parsed.apiKey === "string" ? parsed.apiKey : "";
  if (!apiKey.startsWith("sk-")) throw new Error("The studio secret did not contain a usable key. No image was requested.");
  return apiKey;
}

async function renderScene(apiKey: string, scene: BatchScene): Promise<Buffer> {
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ model: STILL_IMAGE_MODEL, prompt: scene.prompt, n: 1, size: "1024x1024", quality: "low" }),
  });
  const body = (await response.json().catch(() => null)) as { data?: { b64_json?: string }[]; error?: { message?: string } } | null;
  if (!response.ok) {
    throw new Error(body?.error?.message || `The image model returned ${response.status}. Later images were not requested.`);
  }
  const b64 = body?.data?.[0]?.b64_json;
  if (!b64) throw new Error(`Image ${scene.id} returned no bytes. Later images were not requested.`);
  return Buffer.from(b64, "base64");
}

export async function generateNextStill(input: { category: string; confirmed: boolean; reviewer: string; now?: string; batchSize?: number }): Promise<GenerateStillResult> {
  const now = input.now ?? new Date().toISOString();
  const reviews = await listStudioReviews();
  const skipped = await listSkippedSceneIds();
  const plan = planStillBatch({
    category: input.category,
    existingIds: [...reviews.map((item) => item.id), ...skipped],
    spentUsd: studioSpendUsd(reviews.filter((item) => item.synthetic).length + skipped.length),
    capUsd: spendCap(),
    confirmed: input.confirmed,
    batchSize: input.batchSize,
  });
  if (!plan.ok) return { ...plan, liveDetection: "disabled" };
  const committedSpend = studioSpendUsd(reviews.filter((item) => item.synthetic).length + skipped.length);
  const claim = await claimStudioBatch(plan.batchId, input.reviewer, now);
  if (!claim.ok) return { ok: false, generated: false, estimatedUsd: plan.estimatedUsd, reason: claim.reason, liveDetection: "disabled" };

  const scene = plan.scenes[0];
  if (!scene) {
    await releaseStudioBatch(plan.batchId);
    return { ok: false, generated: false, estimatedUsd: 0, reason: "That batch has no remaining scenes.", liveDetection: "disabled" };
  }
  const sceneClaim = await claimScene(scene.id, input.reviewer, now);
  if (!sceneClaim.ok) return { ok: false, generated: false, estimatedUsd: plan.estimatedUsd, reason: sceneClaim.reason, liveDetection: "disabled" };

  try {
    const apiKey = await openAiKey();
    let bytes: Buffer | null = null;
    let providerError = "";
    let qualityError = "";
    for (let attempt = 1; attempt <= GENERATION_ATTEMPT_LIMIT; attempt += 1) {
      if (!attemptFitsSpend(committedSpend, attempt - 1, spendCap())) {
        providerError = "This image would pass the studio spend cap. It was not accepted.";
        break;
      }
      try {
        const rendered = await renderScene(apiKey, scene);
        const quality = validateStudioImage(rendered, "image/png");
        if (!quality.ok) {
          qualityError = quality.reason;
        } else {
          bytes = rendered;
          break;
        }
      } catch (error) {
        providerError = error instanceof Error ? error.message : "The image was not stored.";
      }
      if (attempt < GENERATION_ATTEMPT_LIMIT && attemptFitsSpend(committedSpend, attempt, spendCap())) {
        await delay(generationRetryDelayMs(attempt));
      }
    }

    const remaining = plan.scenes.length - 1;
    if (!bytes && !qualityError && providerError.includes("spend cap")) {
      return {
        ok: false,
        generated: false,
        estimatedUsd: plan.estimatedUsd,
        reason: providerError,
        liveDetection: "disabled",
      };
    }
    if (!bytes) {
      const outcome = qualityError ? "quality_rejected" : "failed";
      await skipScene(plan.batchId, scene.id, outcome);
      const progress = await recordBatchOutcome({ batchId: plan.batchId, requested: plan.requested, outcome });
      if (remaining === 0) await releaseStudioBatch(plan.batchId);
      return {
        ok: true,
        generated: false,
        skipped: true,
        batchId: plan.batchId,
        createdId: null,
        remaining,
        estimatedUsd: plan.estimatedUsd,
        approved: false,
        liveDetection: "disabled",
        progress,
        reason: `${qualityError || providerError} ${progressSummary(progress)}`,
      };
    }

    const key = `studio/synthetic/${plan.batchId}/${scene.index}.png`;
    const generationJobId = `job-${randomUUID()}`;
    const s3 = new S3Client({ region: REGION });
    await s3.send(new PutObjectCommand({ Bucket: STUDIO_ARTIFACT_BUCKET, Key: key, Body: bytes, ContentType: "image/png" }));
    const created = await saveNewStudioReview({
      id: scene.id,
      kind: "synthetic-image",
      status: "REVIEW_REQUIRED",
      approved: false,
      trainingLabel: false,
      modelId: STILL_IMAGE_MODEL,
      category: input.category,
      createdAt: now,
      synthetic: true,
      rightsStatus: "synthetic_internal",
      prompt: scene.prompt,
      s3Key: key,
      lighting: scene.lighting,
      cameraAngle: scene.cameraAngle,
      occlusion: scene.occlusion,
      objectSize: "medium",
      role: scene.role,
      difficulty: scene.difficulty,
      sourceType: "synthetic",
      batchId: plan.batchId,
      distance: scene.distance,
      provenance: "generation_job",
      generationJobId,
      qualityStatus: "passed",
      syntheticPersonAttestation: {
        id: `attest-${generationJobId}`,
        noRealLikenessIntentionallyReproduced: true,
        attestedBy: "studio-generation",
        attestedAt: now,
      },
    });
    const progress = created
      ? await recordBatchOutcome({ batchId: plan.batchId, requested: plan.requested, outcome: "generated" })
      : await readBatchProgress(plan.batchId, plan.requested);
    if (remaining === 0) await releaseStudioBatch(plan.batchId);
    const counts = progressSummary(progress);
    return {
      ok: true,
      generated: created,
      skipped: !created,
      batchId: plan.batchId,
      createdId: scene.id,
      remaining,
      estimatedUsd: plan.estimatedUsd,
      approved: false,
      liveDetection: "disabled",
      progress,
      reason: created
        ? (remaining === 0 ? `Stored the last image in ${plan.batchId}. None of these images were approved. ${counts}` : `Stored ${scene.id}. ${remaining} image${remaining === 1 ? "" : "s"} left in this batch. None were approved. ${counts}`)
        : `Image ${scene.id} was already stored. It was not generated again. ${counts}`,
    };
  } finally {
    await releaseScene(scene.id);
  }
}

/** Used by the operator script. The page requests one image per click-loop so a proxy timeout cannot drop the rest. */
export async function generateStillBatch(input: { category: string; reviewer: string; batchSize?: number }): Promise<{ stored: string[]; reason: string }> {
  const stored: string[] = [];
  const limit = input.batchSize ?? 10;
  for (let index = 0; index < limit; index += 1) {
    const result = await generateNextStill({ category: input.category, confirmed: true, reviewer: input.reviewer, batchSize: input.batchSize });
    if (!result.ok) {
      return { stored, reason: result.reason };
    }
    if (result.createdId) {
      stored.push(result.createdId);
      console.log(result.reason);
    }
    if (result.remaining === 0) return { stored, reason: result.reason };
  }
  return { stored, reason: `Stored ${stored.length} images.` };
}

export async function storeUploadedSynthetic(input: {
  category?: string;
  prompt?: string;
  modelId?: string;
  syntheticPeople?: boolean;
  cleanFrame?: boolean;
  contentType?: string;
  imageBase64?: string;
  now?: string;
}): Promise<{ ok: true; createdId: string; approved: false; trainingLabel: false; reason: string } | { ok: false; reason: string }> {
  const encoded = input.imageBase64?.replace(/^data:[^,]+,/, "").trim() ?? "";
  let bytes: Buffer;
  try {
    bytes = Buffer.from(encoded, "base64");
  } catch {
    return { ok: false, reason: "The image could not be read. The image was not stored." };
  }
  const review = reviewSyntheticUpload({
    category: input.category,
    prompt: input.prompt,
    modelId: input.modelId,
    syntheticPeople: input.syntheticPeople,
    cleanFrame: input.cleanFrame,
    contentType: input.contentType,
    byteLength: bytes.length,
  });
  if (!review.ok) return review;
  if (review.media === "image") {
    const quality = validateStudioImage(bytes, review.contentType);
    if (!quality.ok) return quality;
  } else {
    const clip = validateStudioClip(bytes, review.contentType);
    if (!clip.ok) return clip;
  }
  const id = `upload-${randomUUID()}`;
  const extension = review.media === "clip" ? "mp4" : review.contentType === "image/jpeg" ? "jpg" : review.contentType === "image/webp" ? "webp" : "png";
  const key = `studio/synthetic/${review.media === "clip" ? "clips" : "uploads"}/${id}.${extension}`;
  const now = input.now ?? new Date().toISOString();
  const prompt = input.prompt?.trim() ?? "";
  const modelId = input.modelId?.trim() ?? "";
  const category = input.category?.trim() ?? "";
  const s3 = new S3Client({ region: REGION });
  await s3.send(new PutObjectCommand({ Bucket: STUDIO_ARTIFACT_BUCKET, Key: key, Body: bytes, ContentType: review.contentType }));
  await saveStudioReview({
    id,
    kind: review.media === "clip" ? "synthetic-clip" : "synthetic-image",
    status: "REVIEW_REQUIRED",
    approved: false,
    trainingLabel: false,
    modelId,
    category,
    createdAt: now,
    synthetic: true,
    rightsStatus: "synthetic_internal",
    prompt,
    s3Key: key,
    objectSize: "medium",
    role: "positive",
    sourceType: "synthetic",
    batchId: "synthetic-upload",
    distance: "medium",
    provenance: review.media === "clip" ? "clip" : "upload",
    qualityStatus: "passed",
    syntheticPersonAttestation: input.syntheticPeople
      ? {
          id: `attest-${id}`,
          noRealLikenessIntentionallyReproduced: true,
          attestedBy: "upload",
          attestedAt: now,
        }
      : undefined,
  });
  return {
    ok: true,
    createdId: id,
    approved: false,
    trainingLabel: false,
    reason: review.media === "clip"
      ? `Stored the original clip ${id}. No frame was extracted, so nothing from this clip is a training example.`
      : `Stored ${id}. Typed prompt and model text are not a generation job, so this image is not a training example.`,
  };
}
