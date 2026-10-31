/**
 * Model Training Studio review and dataset rules.
 * An OpenAI suggestion is not a verified training label.
 * Live cameras and CAD are outside this module.
 */

export const STUDIO_PARTITION = "STUDIO#rc-admin";
export const STUDIO_EVENTS_TABLE = "rapid-cortex-vision-events-dev";
export const STUDIO_ARTIFACT_BUCKET = "rapid-cortex-vision-artifacts-dev-158961537080";

export const REVIEW_DECISIONS = ["approve", "reject", "correct-label", "request-review"] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

export type StudioReviewStatus = "REVIEW_REQUIRED" | "APPROVED" | "REJECTED" | "CORRECTION_REQUESTED";

export type StudioReviewRecord = {
  id: string;
  kind: "visual-review" | "synthetic-image" | "discovered";
  status: StudioReviewStatus;
  /** Human accepted the candidate for the dataset builder. Still not a verified label. */
  approved: boolean;
  /** True only after a reviewer verifies the label. OpenAI text never sets this. */
  trainingLabel: boolean;
  modelId: string;
  category: string;
  createdAt: string;
  synthetic: boolean;
  sourceUrl?: string;
  license?: string;
  rightsStatus: "REVIEW_REQUIRED" | "UNKNOWN" | "synthetic_internal" | "LICENSE_VERIFIED" | "RESTRICTED";
  objects?: string[];
  uncertainty?: string;
  annotation?: string;
  prompt?: string;
  s3Key?: string;
  lighting?: string | null;
  cameraAngle?: string | null;
  occlusion?: string | null;
  objectSize?: string | null;
  role?: "positive" | "negative";
  correctedLabel?: string;
  reviewerNote?: string;
  author?: string;
  commercialUse?: "unverified" | "permitted" | "not_permitted";
  privacy?: string;
  rightsReviewer?: string;
  rightsVerifiedAt?: string;
  labelReviewer?: string;
  labelVerifiedAt?: string;
  box?: StudioBox | null;
  audit?: ReviewAuditEntry[];
  distance?: string | null;
  difficulty?: "standard" | "challenging";
  sourceType?: "synthetic" | "public" | "unknown";
  batchId?: string;
  imageUrl?: string;
};

export type StudioBox = { x: number; y: number; width: number; height: number };

export type ReviewAuditEntry = {
  at: string;
  reviewer: string;
  action: string;
  note?: string;
};

export function applyReviewDecision(
  record: StudioReviewRecord,
  decision: ReviewDecision,
  note?: string,
): { ok: true; record: StudioReviewRecord } | { ok: false; reason: string } {
  if (decision === "correct-label" && !note?.trim()) {
    return { ok: false, reason: "A corrected label is required." };
  }
  if (decision === "approve" && !record.rightsVerifiedAt) {
    return { ok: false, reason: "License review is still open. This candidate cannot be approved for a dataset." };
  }
  if (decision === "approve" && (record.rightsStatus === "UNKNOWN" || record.rightsStatus === "REVIEW_REQUIRED" || record.rightsStatus === "RESTRICTED")) {
    return { ok: false, reason: "License review is still open. This candidate cannot be approved for a dataset." };
  }
  if (decision === "reject") {
    return { ok: true, record: { ...record, status: "REJECTED", approved: false, trainingLabel: false, reviewerNote: note?.trim() || record.reviewerNote } };
  }
  if (decision === "request-review") {
    return { ok: true, record: { ...record, status: "REVIEW_REQUIRED", approved: false, trainingLabel: false, reviewerNote: note?.trim() || "Additional review requested." } };
  }
  if (decision === "correct-label") {
    return {
      ok: true,
      record: {
        ...record,
        status: "CORRECTION_REQUESTED",
        approved: false,
        trainingLabel: false,
        correctedLabel: note!.trim(),
        category: note!.trim(),
        reviewerNote: "Label corrected. Still not a verified training label.",
      },
    };
  }
  return {
    ok: true,
    record: {
      ...record,
      status: "APPROVED",
      approved: true,
      trainingLabel: false,
      reviewerNote: record.synthetic
        ? "Synthetic example accepted for review packaging. It is not an independently verified label."
        : "Candidate accepted. OpenAI text is not the training label.",
    },
  };
}

export const BATCH_SIZES = [10, 25, 50, 100] as const;
export type BatchSize = (typeof BATCH_SIZES)[number];

export function planDatasetBatch(input: {
  category: string;
  count: number;
  spentUsd: number;
  capUsd: number;
  batchEnabled: boolean;
}): { ok: false; reason: string; estimatedUsd: number } | { ok: true; estimatedUsd: number; positive: number; negative: number; challenging: number } {
  const estimatedUsd = Math.round(input.count * 0.04 * 100) / 100;
  if (!BATCH_SIZES.includes(input.count as BatchSize)) {
    return { ok: false, reason: "Choose 10, 25, 50, or 100 candidates.", estimatedUsd };
  }
  if (!input.batchEnabled) {
    return { ok: false, reason: "Batch generation is closed. No images were requested.", estimatedUsd };
  }
  if (input.spentUsd + estimatedUsd > input.capUsd) {
    return { ok: false, reason: "This batch would pass the studio spend cap. No images were requested.", estimatedUsd };
  }
  const negative = Math.max(1, Math.round(input.count * 0.3));
  const challenging = Math.max(1, Math.round(input.count * 0.2));
  const positive = input.count - negative - challenging;
  return { ok: true, estimatedUsd, positive, negative, challenging };
}

export function gapFromApproved(records: StudioReviewRecord[]): { category: string; need: string }[] {
  const approved = records.filter((item) => item.status === "APPROVED");
  if (approved.length === 0) {
    return [{ category: "All categories", need: "No approved examples. Lighting, camera angle, object size, and occlusion are Coverage Unknown." }];
  }
  const needs: { category: string; need: string }[] = [];
  const byCategory = new Map<string, StudioReviewRecord[]>();
  for (const item of approved) {
    const rows = byCategory.get(item.category) ?? [];
    rows.push(item);
    byCategory.set(item.category, rows);
  }
  for (const [category, rows] of byCategory) {
    if (!rows.some((item) => item.lighting)) needs.push({ category, need: "Lighting coverage unknown." });
    if (!rows.some((item) => item.cameraAngle)) needs.push({ category, need: "Camera-angle coverage unknown." });
    if (!rows.some((item) => item.objectSize)) needs.push({ category, need: "Object-size coverage unknown." });
    if (!rows.some((item) => item.occlusion)) needs.push({ category, need: "Occlusion coverage unknown." });
    if (!rows.some((item) => item.role === "negative")) needs.push({ category, need: "No harmless lookalike is approved." });
    if (rows.some((item) => item.trainingLabel === false)) needs.push({ category, need: "Approved rows are still not independently verified training labels." });
  }
  return needs;
}

export function submitDatasetForTraining(records: StudioReviewRecord[]): { ok: false; reason: string } {
  const approved = records.filter((item) => item.status === "APPROVED");
  if (approved.length === 0) {
    return { ok: false, reason: "No approved dataset version exists. Training was not started." };
  }
  if (approved.some((item) => item.rightsStatus === "REVIEW_REQUIRED" || item.rightsStatus === "UNKNOWN")) {
    return { ok: false, reason: "Usage rights are still open. Training was not started." };
  }
  if (approved.every((item) => item.trainingLabel === false)) {
    return { ok: false, reason: "OpenAI review text is not a verified training label. Training was not started." };
  }
  if (!approved.some((item) => item.trainingLabel)) {
    return { ok: false, reason: "OpenAI review text is not a verified training label. Training was not started." };
  }
  return { ok: false, reason: "SageMaker training is not connected. No job was launched." };
}

export const MIN_VERIFIED_FOR_TRAINING = 50;
export const FIREARM_PILOT_BATCH_ID = "firearm-like-pilot-10";

export function firearmPilotMix(count: number): { positive: number; negative: number; challenging: number } | null {
  if (count !== 10) return null;
  return { positive: 4, negative: 4, challenging: 2 };
}

export function confirmBatchPlan(input: {
  category: string;
  count: number;
  spentUsd: number;
  capUsd: number;
  batchEnabled: boolean;
  confirmed: boolean;
  activeJob: boolean;
}): ReturnType<typeof planDatasetBatch> & { requiresConfirmation?: boolean } {
  const mix = input.category === "firearm_like" ? firearmPilotMix(input.count) : null;
  const plan = planDatasetBatch(input);
  if (!plan.ok) return plan;
  if (input.activeJob) {
    return { ok: false, reason: "A batch is already queued. No second job was started.", estimatedUsd: plan.estimatedUsd };
  }
  if (!input.confirmed) {
    return {
      ok: false,
      reason: "Confirm the estimate before any image is requested.",
      estimatedUsd: plan.estimatedUsd,
      requiresConfirmation: true,
    };
  }
  if (mix) return { ok: true, estimatedUsd: plan.estimatedUsd, ...mix };
  return plan;
}

export function isRightsClear(record: StudioReviewRecord): boolean {
  if (record.synthetic || record.rightsStatus === "synthetic_internal") {
    return Boolean(record.rightsVerifiedAt);
  }
  return record.rightsStatus !== "REVIEW_REQUIRED" && record.rightsStatus !== "UNKNOWN" && record.commercialUse === "permitted" && Boolean(record.rightsVerifiedAt);
}

export type DatasetVersion = {
  id: string;
  version: number;
  createdAt: string;
  reviewer: string;
  assetIds: string[];
  positiveIds: string[];
  negativeIds: string[];
  syntheticIds: string[];
  realIds: string[];
};

export function assembleDatasetVersion(
  records: StudioReviewRecord[],
  input: { reviewer: string; now: string; version: number },
): { ok: false; reason: string } | { ok: true; version: DatasetVersion } {
  const eligible = records.filter((item) => item.trainingLabel && isRightsClear(item) && item.status === "APPROVED");
  if (eligible.length === 0) {
    return { ok: false, reason: "No verified labels with cleared rights. A dataset version was not created." };
  }
  const positiveIds = eligible.filter((item) => item.role !== "negative").map((item) => item.id);
  const negativeIds = eligible.filter((item) => item.role === "negative").map((item) => item.id);
  return {
    ok: true,
    version: {
      id: `dataset-${input.now.slice(0, 10)}-v${input.version}`,
      version: input.version,
      createdAt: input.now,
      reviewer: input.reviewer,
      assetIds: eligible.map((item) => item.id),
      positiveIds,
      negativeIds,
      syntheticIds: eligible.filter((item) => item.synthetic).map((item) => item.id),
      realIds: eligible.filter((item) => !item.synthetic).map((item) => item.id),
    },
  };
}

export function prepareSageMakerTraining(input: {
  version: DatasetVersion | null;
  costApproved: boolean;
}): { ready: boolean; launched: false; estimatedCostUsd: null; reason: string } {
  if (!input.version) {
    return { ready: false, launched: false, estimatedCostUsd: null, reason: "No approved dataset version exists. Training was not started." };
  }
  if (input.version.assetIds.length < MIN_VERIFIED_FOR_TRAINING) {
    return {
      ready: false,
      launched: false,
      estimatedCostUsd: null,
      reason: `${input.version.assetIds.length} verified examples are stored. ${MIN_VERIFIED_FOR_TRAINING} are required before a detector can be trained. No job was launched.`,
    };
  }
  if (input.version.realIds.length === 0) {
    return {
      ready: false,
      launched: false,
      estimatedCostUsd: null,
      reason: "The dataset has no real-world footage. Synthetic examples are not enough to train a detector. No job was launched.",
    };
  }
  if (input.version.positiveIds.length === 0 || input.version.negativeIds.length === 0) {
    return {
      ready: false,
      launched: false,
      estimatedCostUsd: null,
      reason: "The dataset needs both positive examples and harmless lookalikes. No job was launched.",
    };
  }
  if (!input.costApproved) {
    return { ready: true, launched: false, estimatedCostUsd: null, reason: "The dataset passed the readiness checks. Training cost is not approved, so no job was launched." };
  }
  return { ready: true, launched: false, estimatedCostUsd: null, reason: "SageMaker training is not connected. No job was launched." };
}

export type GapRow = { category: string; need: string };

export function datasetGapReport(records: StudioReviewRecord[]): GapRow[] {
  const base = gapFromApproved(records);
  const approved = records.filter((item) => item.status === "APPROVED");
  if (approved.length === 0) return base;
  const extra: GapRow[] = [];
  const byCategory = new Map<string, StudioReviewRecord[]>();
  for (const item of approved) {
    const rows = byCategory.get(item.category) ?? [];
    rows.push(item);
    byCategory.set(item.category, rows);
  }
  for (const [category, rows] of byCategory) {
    if (!rows.some((item) => item.distance)) extra.push({ category, need: "Object-distance coverage unknown." });
    if (!rows.some((item) => !item.synthetic)) extra.push({ category, need: "No real-world example is approved. Source coverage is synthetic only." });
    if (!rows.some((item) => item.trainingLabel)) extra.push({ category, need: "Label verification is still open." });
    else if (rows.some((item) => !item.trainingLabel)) extra.push({ category, need: "Some approved rows are not verified training labels." });
  }
  return [...base, ...extra];
}
